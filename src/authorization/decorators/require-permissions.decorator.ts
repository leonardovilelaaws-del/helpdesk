import { SetMetadata } from '@nestjs/common';

// Decorators e guard precisam da mesma chave para gravar e ler a regra da rota.
export const PERMISSIONS_KEY = 'authorization:permissions';

/** A regra guarda a lista de ações e se precisa de todas (all) ou apenas uma (any). */
export interface PermissionRequirement {
  permissions: string[];
  mode: 'all' | 'any';
}

/**
 * @RequirePermissions('credito:read', 'credito:update') exige ler E alterar.
 * O decorator apenas anota essa regra; PermissionsGuard a confere antes do controller.
 * A regra do método não apaga uma exigência que já esteja na classe.
 */
export const RequirePermissions = (...permissions: [string, ...string[]]) =>
  SetMetadata(PERMISSIONS_KEY, {
    permissions,
    mode: 'all',
  } satisfies PermissionRequirement);

/**
 * A alternativa explícita para OU: basta ter uma das ações informadas.
 * Exemplo: uma consulta compartilhada pode aceitar compras:read OU credito:read.
 */
export const RequireAnyPermission = (...permissions: [string, ...string[]]) =>
  SetMetadata(PERMISSIONS_KEY, {
    permissions,
    mode: 'any',
  } satisfies PermissionRequirement);
