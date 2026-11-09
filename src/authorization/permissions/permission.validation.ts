import type { PermissionId } from './permission.types';

const segmentPattern = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*$/u;

/**
 * Confere o formato sem corrigir ou gerar o nome: APROVAR e tasks:aprovar
 * podem ser ações distintas. O limite acompanha o VARCHAR(100) do banco.
 */
export function isPermissionId(value: unknown): value is PermissionId {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Array.from(value).length <= 100 &&
    !/[\s\p{C}]/u.test(value) &&
    value.split(':').every((segment) => segmentPattern.test(segment))
  );
}
