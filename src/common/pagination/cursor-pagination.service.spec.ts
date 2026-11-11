import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  type PrismaClient,
  type Task,
  type User,
} from '../../generated/prisma/client';
import { CursorPaginationQueryDto } from './dto/cursor-pagination-query.dto';
import {
  decodeCursorPaginationToken,
  encodeCursorPaginationToken,
} from './cursor-pagination-token';
import { CursorPaginationService } from './cursor-pagination.service';
import { encodeCursorPaginationTimestampId } from './cursor-pagination-timestamp-id';

// Compiled by tsc, but never run against a database.
async function checkPrismaCursorPaginationInference(
  service: CursorPaginationService,
  prisma: PrismaClient,
): Promise<void> {
  const query = new CursorPaginationQueryDto();
  const tasks = await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'name',
      sortOrder: 'asc',
    },
    where: { completed: true },
    findMany: (args) => prisma.task.findMany(args),
  });
  const task: Task | undefined = tasks.data[0];
  void task;

  const users = await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'email',
      sortOrder: 'desc',
    },
    where: { email: { contains: '@example.com' } },
    findMany: (args) =>
      prisma.user.findMany({ ...args, select: { id: true, email: true } }),
  });
  const email: string = users.data[0].email;
  void email;
  // @ts-expect-error Pagination preserves the projection without a password.
  void users.data[0].password;
  // @ts-expect-error Explicit email ordering does not require createdAt in the projection.
  void users.data[0].createdAt;

  const defaultUsers = await service.paginate({
    query: { limit: 10 },
    where: {},
    findMany: (args) =>
      prisma.user.findMany({ ...args, select: { id: true, createdAt: true } }),
  });
  const defaultDate: Date = defaultUsers.data[0].createdAt;
  void defaultDate;
  await service.paginate({
    query: { limit: 10 },
    where: {},
    // @ts-expect-error A literal query without sortBy still requires createdAt.
    findMany: (args) => prisma.user.findMany({ ...args, select: { id: true } }),
  });
  const arbitraryField: string = 'name';
  await service.paginate({
    query: { limit: 10, sortBy: undefined },
    where: {},
    // @ts-expect-error Explicit undefined also requires the default createdAt field.
    findMany: (args) => prisma.user.findMany({ ...args, select: { id: true } }),
  });
  await service.paginate({
    // @ts-expect-error A broad string must be narrowed to the entity's sortable field union.
    query: { limit: 10, sortBy: arbitraryField },
    where: {},
    findMany: (args) => prisma.task.findMany(args),
  });

  await service.paginate({
    query,
    where: { completed: 'invalid' },
    // @ts-expect-error Prisma still rejects invalid field filter types.
    findMany: (args) => prisma.task.findMany(args),
  });
  await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'name',
      // @ts-expect-error Direction is a Prisma.SortOrder.
      sortOrder: 'ascending',
    },
    where: {},
    findMany: (args) => prisma.task.findMany(args),
  });
  await service.paginate({
    query,
    where: {},
    // @ts-expect-error A default projection must include createdAt as well as id.
    findMany: (args) => prisma.user.findMany({ ...args, select: { id: true } }),
  });
  await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'name',
      sortOrder: 'asc',
    },
    where: {},
    findMany: (args) =>
      // @ts-expect-error A dynamic projection must include its selected sort field.
      prisma.user.findMany({ ...args, select: { id: true, createdAt: true } }),
  });
  await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'name',
      sortOrder: 'asc',
    },
    where: {},
    findMany: (args) =>
      // @ts-expect-error The unique ID must also be selected.
      prisma.user.findMany({ ...args, select: { name: true } }),
  });
  await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'user',
      sortOrder: 'asc',
    },
    where: {},
    findMany: (args) =>
      // @ts-expect-error A selected relation is not a supported scalar sort field.
      prisma.task.findMany({ ...args, include: { user: true } }),
  });
  const optionalNameQuery = new CursorPaginationQueryDto<'name'>();
  await service.paginate({
    query: optionalNameQuery,
    where: {},
    findMany: (args) =>
      // @ts-expect-error An optional sortBy also requires the default createdAt projection.
      prisma.user.findMany({ ...args, select: { id: true, name: true } }),
  });
  const bigintRows: { id: string; score: bigint }[] = [];
  await service.paginate({
    query: { limit: 20, sortBy: 'score' },
    where: {},
    // @ts-expect-error BigInt must not be converted to imprecise cursor numbers.
    findMany: async () => bigintRows,
  });
  const decimalRows: { id: string; price: Prisma.Decimal }[] = [];
  await service.paginate({
    query: { limit: 20, sortBy: 'price' },
    where: {},
    // @ts-expect-error Decimal is deliberately outside the scalar cursor contract.
    findMany: async () => decimalRows,
  });
  const nullableRows: { id: string; nickname: string | null }[] = [];
  await service.paginate({
    query: {
      limit: query.limit,
      cursor: query.cursor,
      sortBy: 'nickname',
      sortOrder: 'asc',
    },
    where: {},
    // @ts-expect-error Nullable sort fields are deliberately unsupported.
    findMany: async () => nullableRows,
  });
}
void checkPrismaCursorPaginationInference;

function encodeCursorPaginationPayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

describe('CursorPaginationService', () => {
  let service: CursorPaginationService;
  let findMany: jest.Mock<Promise<Task[]>, [Prisma.TaskFindManyArgs]>;

  const createdAt = new Date('2026-11-05T12:00:00.123Z');
  const tasks: Task[] = [
    {
      id: '5e5818b9-c460-4ef3-bef8-d810a5abe17f',
      userId: 'd6c3cbfb-b8a7-469c-a885-cc1c0be5c16d',
      name: 'Latest task',
      description: 'A task with the newest timestamp',
      completed: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: '2829377f-3bd0-4ac4-a7bf-d32c506af917',
      userId: 'd6c3cbfb-b8a7-469c-a885-cc1c0be5c16d',
      name: 'Same timestamp',
      description: 'An ID breaks the timestamp tie',
      completed: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: '1ee51dc5-5f51-49f9-bffb-2fb1c6621ad8',
      userId: 'd6c3cbfb-b8a7-469c-a885-cc1c0be5c16d',
      name: 'Older task',
      description: 'The lookahead task',
      completed: false,
      createdAt: new Date('2026-11-04T12:00:00.123Z'),
      updatedAt: createdAt,
    },
  ];
  const where: Prisma.TaskWhereInput = { completed: false };
  const defaultOrder = [{ createdAt: 'desc' }, { id: 'desc' }];

  beforeEach(() => {
    service = new CursorPaginationService();
    findMany = jest.fn<Promise<Task[]>, [Prisma.TaskFindManyArgs]>();
  });

  it('returns the default first page with the original filters and a single query', async () => {
    findMany.mockResolvedValue([tasks[0]]);
    const result = await service.paginate({
      query: new CursorPaginationQueryDto(),
      where,
      findMany,
    });
    const firstTask: Task | undefined = result.data[0];
    expect(firstTask).toEqual(tasks[0]);
    expect(result).toEqual({
      data: [tasks[0]],
      meta: { limit: 20, hasNextPage: false, nextCursor: null },
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: defaultOrder,
      take: 21,
    });
    expect(findMany.mock.calls[0][0].where).toBe(where);
  });

  it('accepts explicit ordering and encodes the last returned row instead of lookahead', async () => {
    findMany.mockResolvedValue(tasks);
    const query = Object.assign(new CursorPaginationQueryDto(), { limit: 2 });
    const order = { field: 'createdAt', direction: 'desc' } as const;
    const result = await service.paginate({
      query: {
        limit: query.limit,
        cursor: query.cursor,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      where,
      findMany,
    });
    expect(result).toEqual({
      data: tasks.slice(0, 2),
      meta: {
        limit: 2,
        hasNextPage: true,
        nextCursor: encodeCursorPaginationToken({
          ...order,
          value: tasks[1].createdAt,
          id: tasks[1].id,
        }),
      },
    });
    expect(
      decodeCursorPaginationToken(result.meta.nextCursor ?? '', order),
    ).toEqual({
      ...order,
      id: tasks[1].id,
      value: tasks[1].createdAt,
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: defaultOrder,
      take: 3,
    });
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('skip');
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('cursor');
  });

  it.each([
    { description: 'empty', rows: [] },
    { description: 'shorter than the limit', rows: tasks.slice(0, 1) },
    { description: 'exactly the limit', rows: tasks.slice(0, 2) },
  ])(
    'returns a final page when the result is $description',
    async ({ rows }) => {
      findMany.mockResolvedValue(rows);
      const query = Object.assign(new CursorPaginationQueryDto(), { limit: 2 });
      await expect(
        service.paginate({ query, where, findMany }),
      ).resolves.toEqual({
        data: rows,
        meta: { limit: 2, hasNextPage: false, nextCursor: null },
      });
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith({
        where,
        orderBy: defaultOrder,
        take: 3,
      });
    },
  );

  it.each([
    { field: 'name', direction: 'asc', operator: 'gt' },
    { field: 'name', direction: 'desc', operator: 'lt' },
    { field: 'createdAt', direction: 'asc', operator: 'gt' },
    { field: 'createdAt', direction: 'desc', operator: 'lt' },
    { field: 'updatedAt', direction: 'asc', operator: 'gt' },
    { field: 'updatedAt', direction: 'desc', operator: 'lt' },
  ] as const)(
    'builds $field $direction continuation with a lexicographic filter and ID tie-breaker',
    async ({ field, direction, operator }) => {
      const value = tasks[0][field];
      const cursor = encodeCursorPaginationToken({
        field,
        direction,
        value,
        id: tasks[0].id,
      });
      const query = Object.assign(new CursorPaginationQueryDto(), {
        limit: 2,
        cursor,
      });
      findMany.mockResolvedValue([]);
      await service.paginate({
        query: {
          limit: query.limit,
          cursor: query.cursor,
          sortBy: field,
          sortOrder: direction,
        },
        where,
        findMany,
      });
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            where,
            {
              AND: {
                [field]: { [direction === 'asc' ? 'gte' : 'lte']: value },
              },
              OR: [
                { [field]: { [operator]: value } },
                { [field]: value, id: { [operator]: tasks[0].id } },
              ],
            },
          ],
        },
        orderBy: [{ [field]: direction }, { id: direction }],
        take: 3,
      });
    },
  );

  it.each([
    { direction: 'asc', value: false, operator: 'gt', next: true },
    { direction: 'asc', value: true, operator: 'gt', next: undefined },
    { direction: 'desc', value: true, operator: 'lt', next: false },
    { direction: 'desc', value: false, operator: 'lt', next: undefined },
  ] as const)(
    'handles completed=$value $direction without comparing booleans',
    async ({ direction, value, operator, next }) => {
      const cursor = encodeCursorPaginationToken({
        field: 'completed',
        direction,
        value,
        id: tasks[0].id,
      });
      const query = Object.assign(new CursorPaginationQueryDto(), { cursor });
      findMany.mockResolvedValue([]);
      await service.paginate({
        query: {
          limit: query.limit,
          cursor: query.cursor,
          sortBy: 'completed',
          sortOrder: direction,
        },
        where,
        findMany,
      });
      const tie = { completed: value, id: { [operator]: tasks[0].id } };
      expect(findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            where,
            { OR: next === undefined ? [tie] : [{ completed: next }, tie] },
          ],
        },
        orderBy: [{ completed: direction }, { id: direction }],
        take: 21,
      });
      expect(findMany).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['asc', 'desc'] as const)(
    'supports ordering only by id %s without adding id twice',
    async (direction) => {
      const cursor = encodeCursorPaginationToken({
        field: 'id',
        direction,
        value: tasks[0].id,
        id: tasks[0].id,
      });
      const query = Object.assign(new CursorPaginationQueryDto(), { cursor });
      findMany.mockResolvedValue([]);
      await service.paginate({
        query: {
          limit: query.limit,
          cursor: query.cursor,
          sortBy: 'id',
          sortOrder: direction,
        },
        where,
        findMany,
      });
      expect(findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            where,
            { id: { [direction === 'asc' ? 'gt' : 'lt']: tasks[0].id } },
          ],
        },
        orderBy: [{ id: direction }],
        take: 21,
      });
    },
  );

  it.each(['asc', 'desc'] as const)(
    'supports numeric %s pagination on an entity without createdAt',
    async (direction) => {
      interface ScoredItem {
        id: string;
        score: number;
      }
      const rows: ScoredItem[] = [
        { id: tasks[0].id, score: 12.5 },
        { id: tasks[1].id, score: 12.5 },
      ];
      const numericFindMany = jest
        .fn<Promise<ScoredItem[]>, [unknown]>()
        .mockResolvedValue(rows);
      const query = Object.assign(new CursorPaginationQueryDto(), { limit: 1 });
      const page = await service.paginate({
        query: {
          limit: query.limit,
          cursor: query.cursor,
          sortBy: 'score',
          sortOrder: direction,
        },
        where: {},
        findMany: numericFindMany,
      });
      const firstItem: ScoredItem | undefined = page.data[0];
      expect(firstItem).toEqual(rows[0]);
      expect(
        decodeCursorPaginationToken(page.meta.nextCursor ?? '', {
          field: 'score',
          direction,
        }),
      ).toEqual({
        field: 'score',
        direction,
        value: 12.5,
        id: rows[0].id,
      });
      numericFindMany.mockResolvedValue([rows[1]]);
      await service.paginate({
        query: {
          limit: 1,
          cursor: page.meta.nextCursor ?? undefined,
          sortBy: 'score',
          sortOrder: direction,
        },
        where: {},
        findMany: numericFindMany,
      });
      const operator = direction === 'asc' ? 'gt' : 'lt';
      expect(numericFindMany).toHaveBeenLastCalledWith({
        where: {
          AND: [
            {},
            {
              AND: { score: { [direction === 'asc' ? 'gte' : 'lte']: 12.5 } },
              OR: [
                { score: { [operator]: 12.5 } },
                { score: 12.5, id: { [operator]: rows[0].id } },
              ],
            },
          ],
        },
        orderBy: [{ score: direction }, { id: direction }],
        take: 2,
      });
    },
  );

  it('accepts a legacy cursor and preserves AND, OR and NOT filters without mutation', async () => {
    const query = Object.assign(new CursorPaginationQueryDto(), {
      limit: 2,
      cursor: encodeCursorPaginationTimestampId(tasks[1]),
    });
    const filters: Prisma.TaskWhereInput = {
      userId: tasks[0].userId,
      AND: [{ completed: false }],
      OR: [
        { name: { contains: 'task' } },
        { description: { contains: 'task' } },
      ],
      NOT: { name: 'Excluded' },
    };
    const originalFilters = structuredClone(filters);
    findMany.mockResolvedValue([tasks[2]]);
    await expect(
      service.paginate({ query, where: filters, findMany }),
    ).resolves.toEqual({
      data: [tasks[2]],
      meta: { limit: 2, hasNextPage: false, nextCursor: null },
    });
    expect(filters).toEqual(originalFilters);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          filters,
          {
            AND: { createdAt: { lte: createdAt } },
            OR: [
              { createdAt: { lt: createdAt } },
              { createdAt, id: { lt: tasks[1].id } },
            ],
          },
        ],
      },
      orderBy: defaultOrder,
      take: 3,
    });
  });

  it.each([0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid limit %s without querying',
    async (limit) => {
      await expect(
        service.paginate({ query: { limit }, where, findMany }),
      ).rejects.toThrow(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    '',
    'invalid+base64',
    'a',
    Buffer.from('{invalid-json').toString('base64url'),
    encodeCursorPaginationPayload({
      id: 'invalid',
      createdAt: createdAt.toISOString(),
    }),
    encodeCursorPaginationPayload({
      id: tasks[0].id,
      createdAt: '2026-02-30T00:00:00.000Z',
    }),
  ])('rejects an invalid cursor before querying: %s', async (cursor) => {
    const query = Object.assign(new CursorPaginationQueryDto(), { cursor });
    await expect(service.paginate({ query, where, findMany })).rejects.toThrow(
      BadRequestException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each([
    { sortBy: 'name', sortOrder: 'asc' },
    { sortBy: 'createdAt', sortOrder: 'asc' },
  ] as const)(
    'rejects a legacy cursor for a new ordering: %j',
    async (ordering) => {
      const query = Object.assign(new CursorPaginationQueryDto(), {
        cursor: encodeCursorPaginationTimestampId(tasks[0]),
      });
      await expect(
        service.paginate({
          query: { limit: query.limit, cursor: query.cursor, ...ordering },
          where,
          findMany,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    { sortBy: 'name', sortOrder: 'desc' },
    { sortBy: 'updatedAt', sortOrder: 'asc' },
  ] as const)(
    'rejects a cursor if its order changes to %j',
    async (ordering) => {
      const cursor = encodeCursorPaginationToken({
        field: 'name',
        direction: 'asc',
        value: tasks[0].name,
        id: tasks[0].id,
      });
      const query = Object.assign(new CursorPaginationQueryDto(), { cursor });
      await expect(
        service.paginate({
          query: { limit: query.limit, cursor: query.cursor, ...ordering },
          where,
          findMany,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    },
  );

  it('preserves Prisma validation errors with a cursor because their cause is ambiguous', async () => {
    const cursor = encodeCursorPaginationToken({
      field: 'completed',
      direction: 'asc',
      value: 1,
      id: tasks[0].id,
    });
    const query = Object.assign(new CursorPaginationQueryDto(), { cursor });
    const error = new Prisma.PrismaClientValidationError('Expected Boolean', {
      clientVersion: '7.10.1',
    });
    findMany.mockRejectedValue(error);
    await expect(
      service.paginate({
        query: {
          limit: query.limit,
          cursor: query.cursor,
          sortBy: 'completed',
          sortOrder: 'asc',
        },
        where,
        findMany,
      }),
    ).rejects.toBe(error);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('rejects an incompatible cursor scalar even if a non-Prisma adapter accepts the query', async () => {
    const cursor = encodeCursorPaginationToken({
      field: 'createdAt',
      direction: 'desc',
      value: createdAt.toISOString(),
      id: tasks[0].id,
    });
    findMany.mockResolvedValue([tasks[1]]);
    await expect(
      service.paginate({
        query: Object.assign(new CursorPaginationQueryDto(), { cursor }),
        where,
        findMany,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cannot infer the schema from a well-formed cursor when a query returns no rows', async () => {
    const cursor = encodeCursorPaginationToken({
      field: 'createdAt',
      direction: 'desc',
      value: createdAt.toISOString(),
      id: tasks[0].id,
    });
    findMany.mockResolvedValue([]);
    await expect(
      service.paginate({ query: { limit: 20, cursor }, where, findMany }),
    ).resolves.toEqual({
      data: [],
      meta: { limit: 20, hasNextPage: false, nextCursor: null },
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('propagates an unexpected database error without additional queries', async () => {
    const error = new Error('Database operation failed');
    findMany.mockRejectedValue(error);
    await expect(
      service.paginate({
        query: new CursorPaginationQueryDto(),
        where,
        findMany,
      }),
    ).rejects.toBe(error);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('preserves Prisma validation errors without a cursor rather than hiding implementation errors', async () => {
    const error = new Prisma.PrismaClientValidationError(
      'Invalid application query',
      { clientVersion: '7.10.1' },
    );
    findMany.mockRejectedValue(error);
    await expect(
      service.paginate({
        query: new CursorPaginationQueryDto(),
        where,
        findMany,
      }),
    ).rejects.toBe(error);
  });

  it('supports User filters and a selected public payload without losing its type', async () => {
    type UserSummary = Pick<User, 'id' | 'createdAt' | 'email'>;
    const users: UserSummary[] = [
      { id: tasks[0].id, createdAt, email: 'alice@example.com' },
      { id: tasks[1].id, createdAt, email: 'bob@example.com' },
    ];
    const userFindMany = jest
      .fn<Promise<UserSummary[]>, [Prisma.UserFindManyArgs]>()
      .mockResolvedValue(users);
    const userWhere: Prisma.UserWhereInput = {
      email: { contains: '@example.com' },
    };
    const select = {
      id: true,
      createdAt: true,
      email: true,
    } satisfies Prisma.UserSelect;
    const result = await service.paginate({
      query: Object.assign(new CursorPaginationQueryDto(), { limit: 1 }),
      where: userWhere,
      findMany: (args) => userFindMany({ ...args, select }),
    });
    const firstUser: UserSummary | undefined = result.data[0];
    expect(firstUser).toEqual(users[0]);
    expect(result).toEqual({
      data: [users[0]],
      meta: {
        limit: 1,
        hasNextPage: true,
        nextCursor: encodeCursorPaginationToken({
          field: 'createdAt',
          direction: 'desc',
          value: createdAt,
          id: users[0].id,
        }),
      },
    });
    expect(userFindMany).toHaveBeenCalledTimes(1);
    expect(userFindMany).toHaveBeenCalledWith({
      where: userWhere,
      orderBy: defaultOrder,
      take: 2,
      select,
    });
  });

  it.each([
    { label: 'null', value: null },
    { label: 'missing', value: undefined },
    { label: 'a relation', value: { id: tasks[0].id } },
    { label: 'a list', value: ['first'] },
    { label: 'BigInt', value: 123n },
    { label: 'Decimal', value: new Prisma.Decimal('1.25') },
  ])(
    'rejects $label sort values returned by untyped callers',
    async ({ value }) => {
      await expect(
        service.paginate({
          query: new CursorPaginationQueryDto(),
          where: {},
          // @ts-expect-error Exercise runtime safeguards for callers bypassing the scalar contract.
          findMany: async () => [{ id: tasks[0].id, createdAt: value }],
        }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it.each([
    { sortBy: 'user.name' },
    { sortBy: '' },
    { sortBy: null },
    { sortBy: ['name'] },
    { sortBy: {} },
    { sortOrder: 'ascending' },
    { sortOrder: null },
    { sortOrder: ['asc'] },
  ])('rejects invalid ordering from untyped callers: %j', async (ordering) => {
    await expect(
      service.paginate({
        // @ts-expect-error External JavaScript can bypass query validation.
        query: { limit: 20, ...ordering },
        where,
        findMany,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
