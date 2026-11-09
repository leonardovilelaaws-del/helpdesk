import type { ValueProvider } from '@nestjs/common';
import type { PermissionCatalog, PermissionId } from './permission.types';

// Providers são locais ao módulo: vários módulos podem usar este mesmo token
// para entregar seus objetos `as const`, sem uma lista central de imports.
export const PERMISSIONS_CATALOG_TOKEN = Symbol('permissions-catalog');

export type InitialRolePermissions = Readonly<
  Record<string, readonly PermissionId[]>
>;

/** Mantém os vínculos iniciais opcionais que só o seed explícito aplica às roles. */
export class RegisteredPermissionCatalog {
  readonly permissions: PermissionCatalog;
  readonly rolePermissions: InitialRolePermissions;

  constructor(
    permissions: PermissionCatalog,
    rolePermissions: InitialRolePermissions,
  ) {
    if (
      !permissions ||
      typeof permissions !== 'object' ||
      Array.isArray(permissions)
    ) {
      throw new Error('A permission catalog must be an object');
    }
    if (
      !rolePermissions ||
      typeof rolePermissions !== 'object' ||
      Array.isArray(rolePermissions)
    ) {
      throw new Error('Initial role permissions must be an object');
    }
    this.permissions = Object.freeze({ ...permissions });
    this.rolePermissions = Object.freeze(
      Object.fromEntries(
        Object.entries(rolePermissions).map(([role, names]) => {
          if (!Array.isArray(names))
            throw new Error(`Permissions for role ${role} must be an array`);
          return [role, Object.freeze([...names])];
        }),
      ),
    );
  }
}

/**
 * Alternativa ao token direto para módulos que também declaram dados do seed.
 * Tokens únicos permitem registrar mais de um catálogo no mesmo módulo sem sobrescrevê-los.
 * A sincronização automática lê apenas as permissões, nunca concede esses vínculos.
 */
export function providePermissions(
  permissions: PermissionCatalog,
  rolePermissions: InitialRolePermissions = {},
): ValueProvider<RegisteredPermissionCatalog> {
  return {
    provide: Symbol('permission-catalog'),
    useValue: new RegisteredPermissionCatalog(permissions, rolePermissions),
  };
}
