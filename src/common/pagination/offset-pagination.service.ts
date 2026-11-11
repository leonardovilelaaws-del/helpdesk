import { BadRequestException, Injectable } from '@nestjs/common';
import type { OffsetPaginatedResult } from './interfaces/offset-paginated-result.interface';
import {
  resolvePaginationOrder,
  type PaginationOrderBy,
  type PaginationOrderQuery,
} from './pagination-order';

export interface OffsetPaginationQuery extends PaginationOrderQuery {
  page?: number;
  limit?: number;
}

export interface OffsetPaginationOptions<
  TQuery extends OffsetPaginationQuery,
  TWhere,
  T,
> {
  query: TQuery;
  where: TWhere;
  findMany: (args: {
    where: TWhere;
    orderBy: PaginationOrderBy<TQuery>[];
    skip: number;
    take: number;
  }) => Promise<T[]>;
  count: (args: { where: TWhere }) => Promise<number>;
}

@Injectable()
export class OffsetPaginationService {
  async paginate<const TQuery extends OffsetPaginationQuery, TWhere, T>({
    query,
    where,
    findMany,
    count,
  }: OffsetPaginationOptions<TQuery, TWhere, T>): Promise<
    OffsetPaginatedResult<T>
  > {
    const page = query.page === undefined ? 1 : query.page;
    const limit = query.limit === undefined ? 20 : query.limit;
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BadRequestException(
        'Pagination page must be a positive safe integer',
      );
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException(
        'Pagination limit must be between 1 and 100',
      );
    }
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination offset exceeds the safe integer range',
      );
    }
    const { orderBy } = resolvePaginationOrder(query);
    // Both operations use the original filters. Parallel reads are not a snapshot:
    // concurrent writes can make total differ from the state observed by findMany.
    const [data, total] = await Promise.all([
      findMany({ where, orderBy, skip, take: limit }),
      count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
    };
  }
}
