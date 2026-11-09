import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

// Reutilizamos esta seleção para que criar, consultar e alterar uma role devolvam os mesmos campos.
const roleSelect = {
  id: true,
  name: true,
  description: true,
  rolePermissions: {
    select: { permission: { select: { id: true, name: true } } },
    orderBy: { permission: { name: 'asc' } },
  },
} satisfies Prisma.RoleSelect;

/**
 * Uma role é um perfil, como CREDITO, que reúne várias permissões.
 * Aqui alteramos esses vínculos no banco; os guards consultam o resultado para decidir o acesso.
 */
@Injectable()
export class AuthorizationService {
  // O Nest fornece PrismaService; não precisamos abrir uma conexão para cada método.
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Traz cada perfil com as ações que ele libera, para o administrador enxergar o acesso completo.
   * Buscar só o nome da role não mostraria o que seus usuários podem fazer.
   */
  listRoles() {
    return this.prisma.role.findMany({
      select: roleSelect,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Mostra as ações cadastradas, como credito:read, para escolher ao montar uma role.
   * Estar no catálogo não libera ninguém: a permissão ainda precisa ser associada a uma role.
   */
  listPermissions() {
    return this.prisma.permission.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Cria o perfil vazio: cadastrar "AUDITOR" ainda não dá acesso aos relatórios.
   * As permissões são escolhidas em outra operação, evitando conceder acessos por suposição.
   */
  async createRole(dto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({
        data: { name: dto.name, description: dto.description },
        select: roleSelect,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A role with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Recebe a lista final da role: se ela tinha ler/criar e chega só ler, criar sai.
   * É uma substituição completa, por isso o endpoint usa PUT em vez de acrescentar itens.
   */
  async setRolePermissions(roleId: string, permissionNames: string[]) {
    const permissions = await this.prisma.permission.findMany({
      where: { name: { in: permissionNames } },
      select: { id: true },
    });
    // Conferimos todos os nomes antes de apagar vínculos, para um erro de digitação não retirar acessos.
    if (permissions.length !== permissionNames.length) {
      throw new BadRequestException('One or more permissions do not exist');
    }

    try {
      // deleteMany retira a lista antiga e create grava a nova na mesma operação atômica.
      // Se uma parte falhar, tudo é desfeito: a role não pode ficar com uma lista pela metade.
      return await this.prisma.role.update({
        where: { id: roleId },
        data: {
          rolePermissions: {
            deleteMany: {},
            create: permissions.map(({ id }) => ({ permissionId: id })),
          },
        },
        select: roleSelect,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Role not found');
      }
      throw error;
    }
  }

  /**
   * Liga uma conta a um perfil: associar CREDITO dá a ela as permissões desse perfil.
   * upsert cria o vínculo se faltar; repetir a chamada não cria uma segunda associação.
   */
  async assignUserRole(userId: string, roleId: string): Promise<void> {
    await this.requireUserAndRole(userId, roleId);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  /**
   * Retira só o vínculo escolhido, sem apagar o perfil nem as outras roles da conta.
   * O efeito aparece na próxima requisição, pois as permissões são recarregadas do banco.
   */
  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await this.requireUserAndRole(userId, roleId);
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
  }

  /**
   * Desativar bloqueia o login e encerra os acessos já abertos, sem excluir a conta.
   * Reativar permite um novo login; não reabre as sessões que foram encerradas.
   */
  async setUserStatus(userId: string, isActive: boolean) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        // A transação salva o bloqueio e o fim das sessões juntos.
        // Atualizar o usuário também faz um refresh simultâneo esperar sua vez.
        const user = await transaction.user.update({
          where: { id: userId },
          data: { isActive },
          select: { id: true, name: true, email: true, isActive: true },
        });
        if (!isActive) {
          await transaction.refreshSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return user;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  /**
   * Força a conta a entrar novamente em todos os dispositivos, por exemplo após uma suspeita de roubo.
   * Diferente de desativar, a conta continua liberada para fazer um novo login.
   */
  async revokeUserSessions(userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        // Atualizamos a linha para obter o mesmo bloqueio usado pelo refresh.
        // Sem essa espera, o refresh poderia criar uma sessão nova durante o encerramento.
        await transaction.user.update({
          where: { id: userId },
          data: { updatedAt: new Date() },
          select: { id: true },
        });
        await transaction.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  /**
   * Confere as duas pontas do vínculo antes de associar ou remover uma role.
   * Como as consultas não dependem uma da outra, Promise.all pode executá-las juntas.
   */
  private async requireUserAndRole(userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.prisma.role.findUnique({
        where: { id: roleId },
        select: { id: true },
      }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');
  }
}
