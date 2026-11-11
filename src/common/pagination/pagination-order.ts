import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

export interface PaginationOrderQuery {
  sortBy?: string;
  sortOrder?: Prisma.SortOrder;
}

// An optional sortBy may use the default field instead.
export type PaginationSortField<TQuery extends PaginationOrderQuery> =
  TQuery extends { sortBy: infer TField extends string }
    ? TField
    : TQuery extends { sortBy?: infer TField }
      ? Extract<TField, string> | 'createdAt'
      : 'createdAt';

export type PaginationOrderBy<TQuery extends PaginationOrderQuery> = Partial<
  Record<PaginationSortField<TQuery> | 'id', Prisma.SortOrder>
>;

export function resolvePaginationOrder<TQuery extends PaginationOrderQuery>(
  query: TQuery,
): {
  order: { field: string; direction: Prisma.SortOrder };
  orderBy: PaginationOrderBy<TQuery>[];
} {
  const field = query.sortBy === undefined ? 'createdAt' : query.sortBy;
  const direction = query.sortOrder === undefined ? 'desc' : query.sortOrder;
  // Entity DTOs own the public whitelist; this only checks the generic shape.
  if (
    typeof field !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9_]*$/.test(field) ||
    (direction !== 'asc' && direction !== 'desc')
  ) {
    throw new BadRequestException('Invalid pagination order');
  }
  // TypeScript cannot connect a computed runtime key to PaginationSortField.
  // The key comes only from query.sortBy (or its default), plus the ID tie-breaker.
  const orderBy = (
    field === 'id'
      ? [{ id: direction }]
      : [{ [field]: direction }, { id: direction }]
  ) as PaginationOrderBy<TQuery>[];
  return { order: { field, direction }, orderBy };
}
