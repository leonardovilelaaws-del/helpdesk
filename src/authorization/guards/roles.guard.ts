import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Depois de saber quem é o usuário, verificamos seu perfil de acesso (role).
 * Exemplo: ter a role CREDITO não dá acesso a uma rota que exige COMPRAS.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  // O Reflector lê as regras que @Roles() deixou escritas na classe e no método.
  constructor(private readonly reflector: Reflector) {}

  /**
   * Compara as roles exigidas pela rota com as roles do usuário.
   * Retornar true deixa a requisição continuar; lançar uma exceção a interrompe.
   */
  canActivate(context: ExecutionContext): boolean {
    // Lemos classe e método para o método não remover uma proteção do controller.
    // As regras ausentes são descartadas: não ter @Roles() não cria uma exigência.
    const requirements = this.reflector
      .getAll<(string[] | undefined)[]>(ROLES_KEY, [
        context.getClass(),
        context.getHandler(),
      ])
      .filter((roles): roles is string[] => roles !== undefined);

    // Sem @Roles(), este guard não tem uma regra para conferir; os outros guards continuam.
    if (requirements.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    // 401 indica login ausente ou inválido; 403 indica login válido, mas sem acesso à ação.
    if (!user) throw new UnauthorizedException();
    // Nenhuma role, inclusive ADMIN, substitui automaticamente outra role exigida.
    // some: @Roles('COMPRAS', 'CREDITO') aceita qualquer um desses perfis.
    // every: se classe e método têm regras, o usuário precisa passar nas duas.
    const allowed = requirements.every((roles) =>
      roles.some((role) => user.roles.includes(role)),
    );
    if (!allowed) throw new ForbiddenException('Insufficient roles');
    return true;
  }
}
