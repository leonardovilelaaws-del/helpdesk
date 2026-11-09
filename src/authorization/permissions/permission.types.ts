// O identificador é escrito por completo no catálogo do módulo. Não há uma
// union global: cada objeto `as const` conserva seus próprios tipos literais.
export type PermissionId = string;
export type PermissionCatalog = Readonly<Record<string, PermissionId>>;
