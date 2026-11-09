import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { PermissionId } from './permission.types';
import { isPermissionId } from './permission.validation';
import {
  PERMISSIONS_CATALOG_TOKEN,
  RegisteredPermissionCatalog,
  type InitialRolePermissions,
} from './permission-catalog.provider';

/** Descobre os catálogos no grafo do Nest; não consulta nem altera o banco. */
@Injectable()
export class PermissionRegistryService {
  private permissionNames: readonly PermissionId[] = [];
  private rolePermissions: InitialRolePermissions = {};
  private initialized = false;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly scanner: MetadataScanner,
  ) {}

  /** O sincronizador chama isto no bootstrap, quando todos os módulos já foram carregados. */
  discover(): void {
    this.initialized = false;
    this.initialize();
  }

  /** Entrega os nomes validados ao sincronizador; esta leitura não escreve no banco. */
  getPermissionNames(): readonly PermissionId[] {
    this.initialize();
    return this.permissionNames;
  }

  /** Une os vínculos iniciais declarados pelos módulos, preservando permissões de ambos. */
  getRolePermissions(): InitialRolePermissions {
    this.initialize();
    return this.rolePermissions;
  }

  private initialize(): void {
    if (this.initialized) return;
    const known = new Set<PermissionId>();
    const roles = new Map<string, Set<PermissionId>>();
    const catalogs: RegisteredPermissionCatalog[] = [];

    for (const wrapper of this.discovery.getProviders()) {
      // useExisting cria um apelido para o mesmo provider; não é um segundo catálogo.
      if (wrapper.isAlias) continue;
      const instance: unknown = wrapper.instance;
      const registered =
        instance instanceof RegisteredPermissionCatalog ? instance : undefined;
      if (!registered && wrapper.token !== PERMISSIONS_CATALOG_TOKEN) continue;
      const catalog: unknown = registered ? registered.permissions : instance;
      if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
        throw new Error('A registered permission catalog must be an object');
      }
      if (registered) catalogs.push(registered);
      const names = Object.values(catalog) as unknown[];
      if (names.length === 0)
        throw new Error('A registered permission catalog cannot be empty');
      for (const name of names) {
        if (!isPermissionId(name))
          throw new Error(`Invalid permission identifier: ${String(name)}`);
        if (known.has(name))
          throw new Error(`Duplicate permission identifier: ${name}`);
        known.add(name);
      }
    }

    // Os vínculos podem importar permissões de outro módulo; conferimos só após reunir todos.
    for (const catalog of catalogs) {
      for (const [role, names] of Object.entries(catalog.rolePermissions)) {
        if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(role))
          throw new Error(`Invalid initial role name: ${role}`);
        const permissions = roles.get(role) ?? new Set<PermissionId>();
        for (const name of names) {
          if (!isPermissionId(name) || !known.has(name)) {
            throw new Error(
              `Unregistered permission ${String(name)} in initial role ${role}`,
            );
          }
          permissions.add(name);
        }
        roles.set(role, permissions);
      }
    }

    for (const wrapper of this.discovery.getControllers()) {
      const controller = wrapper.metatype;
      if (typeof controller !== 'function') continue;
      this.validateRequirement(controller, controller.name, known);
      const prototype: unknown = Reflect.get(controller, 'prototype');
      if (!prototype || typeof prototype !== 'object') continue;
      for (const methodName of this.scanner.getAllMethodNames(prototype)) {
        const method: unknown = Reflect.get(prototype, methodName);
        if (typeof method === 'function') {
          this.validateRequirement(
            method,
            `${controller.name}.${methodName}`,
            known,
          );
        }
      }
    }

    this.permissionNames = Object.freeze([...known].sort());
    this.rolePermissions = Object.freeze(
      Object.fromEntries(
        [...roles.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([role, names]) => [role, Object.freeze([...names].sort())]),
      ),
    );
    this.initialized = true;
  }

  /** Valida classe e método separadamente; ALL e ANY continuam sendo decididos pelo guard. */
  private validateRequirement(
    target: Function,
    location: string,
    known: Set<PermissionId>,
  ): void {
    const metadata = this.reflector.get<unknown>(PERMISSIONS_KEY, target);
    if (metadata === undefined) return;
    if (!metadata || typeof metadata !== 'object') {
      throw new Error(`Invalid permission requirement at ${location}`);
    }
    const rule = metadata as { permissions?: unknown; mode?: unknown };
    if (
      !Array.isArray(rule.permissions) ||
      rule.permissions.length === 0 ||
      (rule.mode !== 'all' && rule.mode !== 'any')
    ) {
      throw new Error(`Invalid permission requirement at ${location}`);
    }
    for (const name of rule.permissions as unknown[]) {
      if (!isPermissionId(name) || !known.has(name)) {
        throw new Error(
          `Unregistered permission ${String(name)} at ${location}`,
        );
      }
    }
  }
}
