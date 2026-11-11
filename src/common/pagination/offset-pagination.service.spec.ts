import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  type PrismaClient,
  type Task,
} from '../../generated/prisma/client';
import { OffsetPaginationService } from './offset-pagination.service';

// These calls are compiled by tsc but never execute against a database.
async function checkPrismaOffsetPaginationInference(
  service: OffsetPaginationService,
  prisma: PrismaClient,
): Promise<void> {
  const tasks = await service.paginate({
    query: { page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' },
    where: { completed: false },
    findMany: (args) => prisma.task.findMany(args),
    count: (args) => prisma.task.count(args),
  });
  const task: Task | undefined = tasks.data[0];
  const total: number = tasks.meta.total;
  void task;
  void total;
  // @ts-expect-error Offset pagination never exposes cursor metadata.
  void tasks.meta.nextCursor;

  const users = await service.paginate({
    query: { sortBy: 'name', sortOrder: 'desc' },
    where: { email: { endsWith: '@example.com' } },
    findMany: (args) =>
      prisma.user.findMany({ ...args, select: { email: true } }),
    count: (args) => prisma.user.count(args),
  });
  const email: string = users.data[0].email;
  void email;
  // @ts-expect-error The Prisma projection is preserved, including omission of the sort field.
  void users.data[0].name;
  // @ts-expect-error No implicit ID or password is added to the result.
  void users.data[0].password;

  await service.paginate({
    query: {},
    where: { completed: 'invalid' },
    // @ts-expect-error A filter must remain compatible with the Prisma delegate.
    findMany: (args) => prisma.task.findMany(args),
    // @ts-expect-error The count callback receives the same typed filter.
    count: (args) => prisma.task.count(args),
  });
  await service.paginate({
    query: {
      // @ts-expect-error The direction is a Prisma.SortOrder.
      sortOrder: 'ascending',
    },
    where: {},
    findMany: (args) => prisma.task.findMany(args),
    count: (args) => prisma.task.count(args),
  });
}
void checkPrismaOffsetPaginationInference;

describe('OffsetPaginationService', () => {
  let service: OffsetPaginationService;
  let findMany: jest.Mock<Promise<Task[]>, [Prisma.TaskFindManyArgs]>;
  let count: jest.Mock<Promise<number>, [Prisma.TaskCountArgs]>;
  const createdAt = new Date('2026-11-06T12:00:00.000Z');
  const task: Task = {
    id: '5e5818b9-c460-4ef3-bef8-d810a5abe17f',
    userId: 'd6c3cbfb-b8a7-469c-a885-cc1c0be5c16d',
    name: 'Study pagination',
    description: 'One returned row',
    completed: false,
    createdAt,
    updatedAt: createdAt,
  };

  beforeEach(() => {
    service = new OffsetPaginationService();
    findMany = jest
      .fn<Promise<Task[]>, [Prisma.TaskFindManyArgs]>()
      .mockResolvedValue([task]);
    count = jest
      .fn<Promise<number>, [Prisma.TaskCountArgs]>()
      .mockResolvedValue(1);
  });

  it('applies defaults and returns the independent page contract with exactly two queries', async () => {
    const where: Prisma.TaskWhereInput = { completed: false };
    await expect(
      service.paginate({ query: {}, where, findMany, count }),
    ).resolves.toEqual({
      data: [task],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('cursor');
  });

  it.each([
    {
      page: 1,
      total: 25,
      data: [task],
      totalPages: 3,
      next: true,
      previous: false,
    },
    {
      page: 2,
      total: 25,
      data: [task],
      totalPages: 3,
      next: true,
      previous: true,
    },
    {
      page: 3,
      total: 25,
      data: [task],
      totalPages: 3,
      next: false,
      previous: true,
    },
    {
      page: 4,
      total: 25,
      data: [],
      totalPages: 3,
      next: false,
      previous: true,
    },
    {
      page: 1,
      total: 0,
      data: [],
      totalPages: 0,
      next: false,
      previous: false,
    },
    {
      page: 8,
      total: 0,
      data: [],
      totalPages: 0,
      next: false,
      previous: false,
    },
    {
      page: 2,
      total: 20,
      data: [task],
      totalPages: 2,
      next: false,
      previous: true,
    },
  ])(
    'returns page $page of $total records, including empty and out-of-range pages',
    async ({ page, total, data, totalPages, next, previous }) => {
      findMany.mockResolvedValue(data);
      count.mockResolvedValue(total);
      const result = await service.paginate({
        query: { page, limit: 10 },
        where: {},
        findMany,
        count,
      });
      expect(result).toEqual({
        data,
        meta: {
          page,
          limit: 10,
          total,
          totalPages,
          hasNextPage: next,
          hasPreviousPage: previous,
        },
      });
      expect(findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 10,
        take: 10,
      });
      expect(count).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['name', 'createdAt', 'updatedAt', 'completed', 'id'] as const)(
    'keeps %s ordering deterministic in both directions',
    async (sortBy) => {
      for (const sortOrder of ['asc', 'desc'] as const) {
        await service.paginate({
          query: { page: 3, limit: 4, sortBy, sortOrder },
          where: {},
          findMany,
          count,
        });
        expect(findMany).toHaveBeenLastCalledWith({
          where: {},
          orderBy:
            sortBy === 'id'
              ? [{ id: sortOrder }]
              : [{ [sortBy]: sortOrder }, { id: sortOrder }],
          skip: 8,
          take: 4,
        });
      }
    },
  );

  it('defaults the field and direction independently', async () => {
    await service.paginate({
      query: { sortOrder: 'asc' },
      where: {},
      findMany,
      count,
    });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    await service.paginate({
      query: { sortBy: 'name' },
      where: {},
      findMany,
      count,
    });
    expect(findMany.mock.calls[1][0].orderBy).toEqual([
      { name: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('passes the identical immutable filters to findMany and count', async () => {
    const where: Prisma.TaskWhereInput = {
      userId: task.userId,
      AND: [{ completed: false }],
      OR: [
        { name: { contains: 'Study', mode: 'insensitive' } },
        { description: 'Alternative' },
      ],
      NOT: { name: 'Excluded' },
    };
    const before = structuredClone(where);
    Object.freeze(where);
    await service.paginate({
      query: { page: 2, limit: 5, sortBy: 'name' },
      where,
      findMany,
      count,
    });
    expect(where).toEqual(before);
    expect(findMany.mock.calls[0][0].where).toBe(where);
    expect(count.mock.calls[0][0].where).toBe(where);
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('starts count while findMany is still pending', async () => {
    let releaseRows!: (rows: Task[]) => void;
    let releaseCount!: (total: number) => void;
    findMany.mockReturnValue(
      new Promise<Task[]>((resolve) => {
        releaseRows = resolve;
      }),
    );
    count.mockReturnValue(
      new Promise<number>((resolve) => {
        releaseCount = resolve;
      }),
    );
    const pending = service.paginate({ query: {}, where: {}, findMany, count });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    releaseRows([task]);
    releaseCount(12);
    await expect(pending).resolves.toMatchObject({
      data: [task],
      meta: { total: 12 },
    });
  });

  it.each(['findMany', 'count'] as const)(
    'propagates an original %s error',
    async (operation) => {
      const error = new Prisma.PrismaClientValidationError(
        'Invalid business filter',
        { clientVersion: '7.10.1' },
      );
      (operation === 'findMany' ? findMany : count).mockRejectedValue(error);
      await expect(
        service.paginate({ query: {}, where: {}, findMany, count }),
      ).rejects.toBe(error);
    },
  );

  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { page: NaN },
    { page: Infinity },
    { page: Number.MAX_SAFE_INTEGER + 1 },
    { limit: 0 },
    { limit: -1 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: NaN },
    { limit: Infinity },
    { page: Number.MAX_SAFE_INTEGER, limit: 2 },
  ])(
    'rejects invalid numbers or an unsafe offset before querying: %j',
    async (query) => {
      await expect(
        service.paginate({ query, where: {}, findMany, count }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
      expect(count).not.toHaveBeenCalled();
    },
  );

  it('accepts a large safe offset without rounding it or loading all records', async () => {
    const page = Number.MAX_SAFE_INTEGER;
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await service.paginate({
      query: { page, limit: 1 },
      where: {},
      findMany,
      count,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: page - 1,
      take: 1,
    });
  });
});
