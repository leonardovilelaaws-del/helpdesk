import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  PERMISSIONS_KEY,
  type PermissionRequirement,
} from '../decorators/require-permissions.decorator';
import { REQUIRE_ROLES_KEY } from '../decorators/require-role.decorator';

/**
 * Uma role reúne ações, mas cada rota pode exigir uma ação específica.
 * Exemplo: credito:read permite consultar Crédito; não permite ler seu relatório.
 * @RequireRole() permite declarar uma role como alternativa às permissões.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  // O Reflector lê as permissões e as roles alternativas da classe e do método.
  constructor(private readonly reflector: Reflector) {}

  /**
   * Usa o usuário que a autenticação já colocou na requisição e confere suas ações liberadas.
   * A lista veio do banco agora: remover uma permissão afeta a próxima requisição.
   */
  canActivate(context: ExecutionContext): boolean {
    // Mantemos cada nível separado: uma alternativa no método não dispensa a regra da classe.
    const requirements = [context.getClass(), context.getHandler()]
      .map((target) => ({
        permissions: this.reflector.get<PermissionRequirement | undefined>(
          PERMISSIONS_KEY,
          target,
        ),
        roles: this.reflector.get<string[] | undefined>(
          REQUIRE_ROLES_KEY,
          target,
        ),
      }))
      .filter(
        ({ permissions, roles }) =>
          permissions !== undefined || roles !== undefined,
      );

    // Sem permissões nem roles alternativas, este guard libera; o login continua obrigatório.
    if (requirements.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    // Não estar autenticado é diferente de estar autenticado sem a permissão necessária.
    if (!user) throw new UnauthorizedException();
    // Inclusive ADMIN precisa cumprir as regras declaradas na classe E no método.
    // Em cada nível, basta a role OU a regra de permissões.
    const allowed = requirements.every(({ permissions, roles }) => {
      const hasRole = roles?.some((role) => user.roles.includes(role));
      if (hasRole) return true;
      // Role sozinha não pode liberar quem não a possui.
      if (!permissions) return false;

      // Comparamos o nome completo: credito:read e credito:relatorio:read são diferentes.
      const hasPermission = (permission: string) =>
        user.permissions.includes(permission);
      // all + every: ler E alterar. any + some: ler OU alterar.
      return permissions.mode === 'all'
        ? permissions.permissions.every(hasPermission)
        : permissions.permissions.some(hasPermission);
    });
    if (!allowed)
      throw new ForbiddenException('Insufficient permissions or roles');
    return true;
  }
}
