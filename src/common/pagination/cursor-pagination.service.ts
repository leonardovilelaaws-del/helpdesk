import { BadRequestException, Injectable } from '@nestjs/common';
import type { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto';
import type { CursorPaginatedResult } from './interfaces/cursor-paginated-result.interface';
import {
  decodeCursorPaginationToken,
  encodeCursorPaginationToken,
  getCursorPaginationScalarType,
  isCursorPaginationScalar,
  isRecord,
  type CursorPaginationScalar,
  type CursorPaginationPosition,
} from './cursor-pagination-token';
import {
  resolvePaginationOrder,
  type PaginationOrderBy,
  type PaginationSortField,
} from './pagination-order';

type CursorPaginationCondition = Record<
  string,
  | CursorPaginationScalar
  | {
      gt?: CursorPaginationScalar;
      lt?: CursorPaginationScalar;
      gte?: CursorPaginationScalar;
      lte?: CursorPaginationScalar;
    }
>;
type CursorPaginationWhere =
  | CursorPaginationCondition
  | { AND?: CursorPaginationCondition; OR: CursorPaginationCondition[] };
type CursorPaginationFilter<TWhere> =
  TWhere | { AND: [TWhere, CursorPaginationWhere] };

export interface CursorPaginationOptions<
  TQuery extends CursorPaginationQueryDto<string>,
  TWhere,
  T extends { id: string } & Record<
    PaginationSortField<TQuery>,
    CursorPaginationScalar
  >,
> {
  query: TQuery & { sortBy?: keyof T & string };
  where: TWhere;
  findMany: (args: {
    where: CursorPaginationFilter<TWhere>;
    orderBy: PaginationOrderBy<TQuery>[];
    take: number;
  }) => Promise<T[]>;
}

function getCursorPaginationWhere({
  field,
  direction,
  value,
  id,
}: CursorPaginationPosition): CursorPaginationWhere {
  const comparison = direction === 'asc' ? 'gt' : 'lt';
  if (field === 'id') return { id: { [comparison]: id } };

  const conditions: CursorPaginationCondition[] = [];
  if (typeof value === 'boolean') {
    // PostgreSQL orders false before true; Prisma Boolean filters have no gt/lt.
    if (value === (direction === 'desc')) {
      conditions.push({ [field]: !value });
    }
  } else {
    conditions.push({ [field]: { [comparison]: value } });
  }
  conditions.push({ [field]: value, id: { [comparison]: id } });
  if (typeof value === 'boolean') return { OR: conditions };
  // EXPLAIN on PostgreSQL 17 shows this bound avoids scanning earlier index
  // entries for deep cursors. The OR still handles ties (see README).
  return {
    AND: { [field]: { [direction === 'asc' ? 'gte' : 'lte']: value } },
    OR: conditions,
  };
}

@Injectable()
export class CursorPaginationService {
  async paginate<
    const TQuery extends CursorPaginationQueryDto<string>,
    TWhere,
    T extends { id: string } & Record<
      PaginationSortField<TQuery>,
      CursorPaginationScalar
    >,
  >({
    query,
    where,
    findMany,
  }: CursorPaginationOptions<TQuery, TWhere, T>): Promise<
    CursorPaginatedResult<T>
  > {
    const { order, orderBy } = resolvePaginationOrder(query);
    const { field } = order;
    const { limit } = query;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'Pagination limit must be between 1 and 100',
      );
    }
    const cursor =
      query.cursor === undefined
        ? undefined
        : decodeCursorPaginationToken(query.cursor, order);
    const paginatedWhere: CursorPaginationFilter<TWhere> =
      cursor === undefined
        ? where
        : { AND: [where, getCursorPaginationWhere(cursor)] };
    // Prisma errors may originate in the callback or business filters, so they
    // must not all be reclassified as invalid cursors. No schema metadata is used.
    const items = await findMany({
      where: paginatedWhere,
      orderBy,
      take: limit + 1,
    });

    for (const item of items) {
      const row: unknown = item;
      if (!isRecord(row) || !isCursorPaginationScalar(row[field])) {
        throw new BadRequestException(
          'Pagination requires a selected, non-null String, DateTime, Boolean, Int or Float sort field',
        );
      }
      // A tag validates the payload, not the schema. This additional check only
      // works when Prisma returns rows; an empty page cannot prove compatibility.
      if (
        cursor &&
        getCursorPaginationScalarType(row[field]) !==
          getCursorPaginationScalarType(cursor.value)
      ) {
        throw new BadRequestException('Invalid pagination cursor value type');
      }
    }

    const hasNextPage = items.length > limit;
    const data = items.slice(0, limit);
    const lastItem = data[data.length - 1];
    const row: unknown = lastItem;
    const value: unknown = isRecord(row) ? row[field] : undefined;

    return {
      data,
      meta: {
        limit,
        hasNextPage,
        nextCursor:
          hasNextPage &&
          lastItem !== undefined &&
          isCursorPaginationScalar(value)
            ? encodeCursorPaginationToken({ ...order, value, id: lastItem.id })
            : null,
      },
    };
  }
}
