import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { argon2id, hash, verify } from 'argon2';
import { isUUID } from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { lockAuthUser } from './lock-auth-user';

// O usuário pode ter várias roles, e cada role reúne permissões.
// Esta consulta percorre essas relações para descobrir os acessos que valem agora.
const principalSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  userRoles: {
    select: {
      role: {
        select: {
          name: true,
          rolePermissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type Principal = Prisma.UserGetPayload<{ select: typeof principalSelect }>;

/**
 * O JWT carrega sub (usuário), sid (sessão), tipo e expiração em segundos.
 * Ele é assinado, mas seu conteúdo pode ser lido: por isso não colocamos segredos aqui.
 */
interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
  exp: number;
}

// O service entrega este pacote ao controller. Só user vai para o JSON;
// os tokens seguem em cookies para o JavaScript do frontend não precisar recebê-los.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accessExpiresIn: number;
  user: AuthenticatedUser;
}

/**
 * O login prova a identidade com a senha e cria uma sessão no banco.
 * Depois, authenticate confere essa sessão a cada acesso e refresh renova os tokens.
 * A sessão permite encerrar o acesso antes mesmo de o JWT vencer.
 */
@Injectable()
export class AuthService {
  // Sem isto, um e-mail inexistente responderia mais rápido por pular o Argon2.
  // O hash fictício mantém um trabalho parecido e dificulta descobrir contas pelo tempo.
  private readonly dummyPasswordHash = hash(randomBytes(32), {
    type: argon2id,
  });

  // O Nest cria e entrega banco, JWT e configuração; este service usa essas dependências.
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Esta é a etapa que pede a senha. Se ela conferir, criamos uma sessão
   * para o usuário continuar acessando a API sem reenviar a senha a cada chamada.
   */
  async login(dto: LoginDto): Promise<AuthTokens> {
    // 1. Busca a conta pelo e-mail. user.password contém o hash salvo, não a senha original.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { ...principalSelect, password: true },
    });
    // 2. Argon2 confere a senha digitada contra o hash; o hash não é descriptografado.
    let validPassword = false;
    try {
      validPassword = await verify(
        user?.password ?? (await this.dummyPasswordHash),
        dto.password,
      );
    } catch {
      // Se o hash estiver danificado, a conferência falha e o login continua negado.
    }
    // A mesma resposta para todos os casos não revela se o e-mail está cadastrado.
    if (!user || !user.isActive || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. O refresh é um segredo aleatório que permitirá renovar o acesso sem pedir a senha.
    // Guardamos só seu hash: quem ler a tabela não terá o token para usar no navegador.
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const created = await this.prisma.$transaction(async (transaction) => {
      await lockAuthUser(transaction, user.id);
      // 4. Confere de novo após aguardar sua vez: a senha pode ter sido trocada
      // durante a verificação do Argon2. Não podemos abrir sessão com a senha antiga.
      const current = await transaction.user.findUnique({
        where: { id: user.id },
        select: { ...principalSelect, password: true },
      });
      if (!current?.isActive || current.password !== user.password) {
        return null;
      }
      const session = await transaction.refreshSession.create({
        data: {
          userId: current.id,
          familyId: randomUUID(),
          tokenHash: this.hashRefreshToken(refreshToken),
          expiresAt,
        },
        select: { id: true },
      });
      return { user: current, sessionId: session.id };
    });
    if (!created) throw new UnauthorizedException('Invalid email or password');
    return this.issueTokens(
      created.user,
      created.sessionId,
      refreshToken,
      expiresAt,
    );
  }

  /**
   * O access vence em 15 minutos; o refresh permite renová-lo sem pedir a senha.
   * Cada renovação troca também o refresh. Repetir o antigo pode indicar uma cópia,
   * então encerramos toda a cadeia de tokens criada naquele login (a família).
   */
  async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
    if (!this.isRefreshToken(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const now = new Date();
    const nextToken = randomBytes(48).toString('base64url');

    const rotated = await this.prisma.$transaction(async (transaction) => {
      const owner = await transaction.refreshSession.findUnique({
        where: { tokenHash: this.hashRefreshToken(refreshToken) },
        select: { userId: true },
      });
      if (!owner) return null;
      await lockAuthUser(transaction, owner.userId);
      // Depois de localizar a conta, aguardamos o bloqueio e consultamos de novo.
      // A primeira leitura pode ter ficado antiga enquanto outro refresh terminava.
      const session = await transaction.refreshSession.findUnique({
        where: { tokenHash: this.hashRefreshToken(refreshToken) },
        include: { user: { select: principalSelect } },
      });
      if (!session) {
        return null;
      }

      // Se este token já foi usado ou perdeu a validade, encerramos a família inteira.
      // Isso corta também o token novo que alguém possa ter obtido usando uma cópia.
      if (
        session.revokedAt ||
        session.consumedAt ||
        session.expiresAt <= now ||
        !session.user.isActive
      ) {
        await transaction.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      // Consumir significa marcar que este refresh já cumpriu seu único uso.
      // As condições ficam na própria escrita; count=1 confirma que só uma linha foi alterada.
      const consumed = await transaction.refreshSession.updateMany({
        where: {
          id: session.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        await transaction.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null;
      }

      const next = await transaction.refreshSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.hashRefreshToken(nextToken),
          // O substituto herda o prazo: renovar hoje não acrescenta mais sete dias.
          expiresAt: session.expiresAt,
        },
        select: { id: true },
      });
      return { user: session.user, id: next.id, expiresAt: session.expiresAt };
    });

    // Um throw dentro da transação desfaz suas alterações, inclusive a revogação.
    // Por isso primeiro salvamos o encerramento no banco e só depois respondemos 401.
    if (!rotated) {
      throw new UnauthorizedException('Invalid or reused refresh token');
    }
    return this.issueTokens(
      rotated.user,
      rotated.id,
      nextToken,
      rotated.expiresAt,
    );
  }

  /**
   * Um JWT válido prova que nós o emitimos, mas a conta pode ter sido bloqueada depois.
   * Por isso consultamos a sessão e os acessos atuais no banco: logout e mudanças
   * de permissão passam a valer na próxima requisição, sem esperar o JWT vencer.
   */
  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const payload = await this.verifyAccessToken(accessToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      include: { user: { select: principalSelect } },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.consumedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException();
    }
    return this.toAuthenticatedUser(session.user, session.id);
  }

  /**
   * Apagar o cookie só afeta este navegador; uma cópia do JWT ainda poderia existir.
   * Aqui marcamos a família como encerrada no banco. O controller apaga os cookies depois.
   * O refresh permite localizar o login mesmo quando o access já venceu.
   */
  async logout(refreshToken?: string, accessToken?: string): Promise<void> {
    let payload: AccessTokenPayload | undefined;
    if (accessToken) {
      try {
        payload = await this.verifyAccessToken(accessToken);
      } catch (error: unknown) {
        if (!(error instanceof UnauthorizedException)) throw error;
      }
    }
    const selectors: Prisma.RefreshSessionWhereInput[] = [];
    if (this.isRefreshToken(refreshToken)) {
      selectors.push({ tokenHash: this.hashRefreshToken(refreshToken) });
    }
    if (payload) selectors.push({ id: payload.sid, userId: payload.sub });
    if (selectors.length === 0) return;

    await this.prisma.$transaction(async (transaction) => {
      const sessions = await transaction.refreshSession.findMany({
        where: { OR: selectors },
        select: { familyId: true, userId: true },
      });
      // Se uma operação bloquear A e esperar B, e outra bloquear B e esperar A, ambas travam.
      // Ordenar os IDs faz todas pegarem os bloqueios na mesma ordem e evita esse impasse.
      const userIds = [...new Set(sessions.map(({ userId }) => userId))].sort();
      for (const userId of userIds) await lockAuthUser(transaction, userId);
      if (sessions.length > 0) {
        await transaction.refreshSession.updateMany({
          where: {
            familyId: { in: sessions.map(({ familyId }) => familyId) },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
    });
  }

  // Alimenta uma tela como "onde minha conta está conectada".
  // Retorna os IDs para encerrar esses logins, sem entregar tokens que dariam acesso à conta.
  sessions(user: AuthenticatedUser) {
    return this.prisma.refreshSession.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Encerra o login escolhido na lista de sessões. O filtro userId impede
  // alguém de passar o ID de outra conta e encerrar uma sessão que não é sua.
  async revokeSession(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await lockAuthUser(transaction, user.id);
      const session = await transaction.refreshSession.findFirst({
        where: { id: sessionId, userId: user.id },
        select: { familyId: true },
      });
      if (!session) throw new NotFoundException('Session not found');
      await transaction.refreshSession.updateMany({
        where: { familyId: session.familyId, userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  // É a opção "sair de todos os dispositivos": encerra todos os logins da conta.
  // Logout e refresh usam o mesmo bloqueio: nenhum token renovado escapa deste encerramento.
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await lockAuthUser(transaction, userId);
      await transaction.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Apenas decodificar um JWT permite ler seus dados; verifyAsync também confere
   * assinatura e validade. Depois validamos o conteúdo para exigir o contrato da API,
   * mesmo que o token tenha sido assinado corretamente.
   */
  private async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
        issuer: this.configService.getOrThrow<string>('JWT_ISSUER'),
        audience: this.configService.getOrThrow<string>('JWT_AUDIENCE'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !isUUID(payload.sub) ||
      typeof payload.sid !== 'string' ||
      !isUUID(payload.sid) ||
      payload.type !== 'access' ||
      !Number.isInteger(payload.exp)
    ) {
      throw new UnauthorizedException();
    }
    return payload;
  }

  // Assina um JWT ligado ao usuário e à sessão, sem copiar permissões que podem mudar.
  // Devolve os tokens ao controller, que sabe enviá-los por cookie na resposta HTTP.
  private async issueTokens(
    user: Principal,
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<AuthTokens> {
    // Se faltarem dois minutos para o fim da sessão, o access dura dois, e não quinze.
    const accessExpiresIn = Math.min(
      ACCESS_TOKEN_TTL_SECONDS,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    if (accessExpiresIn < 1) throw new UnauthorizedException();
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, sid: sessionId, type: 'access' },
      { expiresIn: accessExpiresIn },
    );
    return {
      accessToken,
      refreshToken,
      expiresAt,
      accessExpiresIn,
      user: await this.toAuthenticatedUser(user, sessionId),
    };
  }

  // O Prisma retorna usuário → roles → permissões. Aqui transformamos essas relações
  // em listas simples para os guards; Set elimina repetições entre roles diferentes.
  private async toAuthenticatedUser(
    user: Principal,
    sessionId: string,
  ): Promise<AuthenticatedUser> {
    const roles = user.userRoles.map(({ role }) => role.name).sort();
    // Para ADMIN, mostramos todo o catálogo em /auth/me. Os guards também têm liberação
    // própria para ADMIN, então não dependem de cadastrar cada vínculo manualmente.
    const permissions = roles.includes('ADMIN')
      ? (await this.prisma.permission.findMany({ select: { name: true } })).map(
          ({ name }) => name,
        )
      : user.userRoles.flatMap(({ role }) =>
          role.rolePermissions.map(({ permission }) => permission.name),
        );
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles,
      permissions: [...new Set(permissions)].sort(),
      sessionId,
    };
  }

  // Calcula uma impressão do refresh: repetindo o cálculo, localizamos o registro no banco.
  // SHA-256 basta para este segredo aleatório; senhas humanas usam Argon2 para dificultar tentativas.
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Os 48 bytes aleatórios viram 64 caracteres em base64url. Rejeitamos outros formatos
  // antes de consultar o banco; ter esse formato, sozinho, ainda não torna o token válido.
  private isRefreshToken(token: string | undefined): token is string {
    return typeof token === 'string' && /^[A-Za-z0-9_-]{64}$/.test(token);
  }
}
