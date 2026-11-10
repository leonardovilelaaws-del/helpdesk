import { SetMetadata } from '@nestjs/common';

// Esta chave separa a alternativa de acesso das roles obrigatórias de @Roles().
export const REQUIRE_ROLES_KEY = 'authorization:require-roles';

/**
 * @RequireRole('ADMIN', 'SUPERVISOR') aceita quem tiver uma dessas roles.
 * Junto de @RequirePermissions() ou @RequireAnyPermission(), permite a role OU as permissões.
 * Essa alternativa vale no mesmo nível: classe ou método; os dois níveis continuam cumulativos.
 * Sem decorator de permissão nesse nível, exige uma das roles informadas.
 * ADMIN também precisa cumprir a regra; não substitui automaticamente outra role.
 */
export const RequireRole = (...roles: [string, ...string[]]) =>
  SetMetadata(REQUIRE_ROLES_KEY, roles);
