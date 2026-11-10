import { SetMetadata } from '@nestjs/common';

// O decorator grava a regra com esta chave; o guard usa a mesma chave para encontrá-la.
export const ROLES_KEY = 'authorization:roles';

/**
 * @Roles('COMPRAS', 'CREDITO') aceita quem tiver um desses dois perfis.
 * SetMetadata só deixa esse "recado" na rota; quem decide o acesso é RolesGuard.
 * Se o controller também tiver @Roles(), a regra dele continua obrigatória.
 * ADMIN também precisa ter uma das roles exigidas em cada nível.
 */
export const Roles = (...roles: [string, ...string[]]) =>
  SetMetadata(ROLES_KEY, roles);
