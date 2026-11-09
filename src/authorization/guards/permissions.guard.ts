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

/**
 * Uma role reúne ações, mas cada rota pode exigir uma ação específica.
 * Exemplo: credito:read permite consultar Crédito; não permite ler seu relatório.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  // O Reflector recupera as permissões anotadas por @RequirePermissions() na rota.
  constructor(private readonly reflector: Reflector) {}

  /**
   * Usa o usuário que a autenticação já colocou na requisição e confere suas ações liberadas.
   * A lista veio do banco agora: remover uma permissão afeta a próxima requisição.
   */
  canActivate(context: ExecutionContext): boolean {
    // A regra do método se soma à regra da classe; ela não pode enfraquecer a proteção.
    const requirements = this.reflector
      .getAll<(PermissionRequirement | undefined)[]>(PERMISSIONS_KEY, [
        context.getClass(),
        context.getHandler(),
      ])
      .filter((rule): rule is PermissionRequirement => rule !== undefined);

    // Sem decorator de permissão, este guard libera; isso não dispensa o login.
    if (requirements.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    // Não estar autenticado é diferente de estar autenticado sem a permissão necessária.
    if (!user) throw new UnauthorizedException();
    // ADMIN pode executar qualquer ação, inclusive novas permissões criadas depois.
    if (user.roles.includes('ADMIN')) return true;

    // O every externo exige que as regras da classe E do método sejam atendidas.
    // Cada regra informa se exige todas as suas permissões ou apenas uma.
    const allowed = requirements.every((rule) => {
      // Comparamos o nome completo: credito:read e credito:relatorio:read são diferentes.
      const hasPermission = (permission: string) =>
        user.permissions.includes(permission);
      // all + every: ler E alterar. any + some: ler OU alterar.
      return rule.mode === 'all'
        ? rule.permissions.every(hasPermission)
        : rule.permissions.some(hasPermission);
    });
    if (!allowed) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
