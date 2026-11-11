import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OffsetPaginationQueryDto } from './offset-pagination-query.dto';

const strictValidation = { whitelist: true, forbidNonWhitelisted: true };

describe('OffsetPaginationQueryDto', () => {
  it('defaults to the first page with twenty records and no cursor', async () => {
    const dto = plainToInstance(OffsetPaginationQueryDto, {});
    expect(dto).toMatchObject({ page: 1, limit: 20 });
    expect(dto.sortBy).toBeUndefined();
    expect(dto.sortOrder).toBeUndefined();
    expect(dto).not.toHaveProperty('cursor');
    await expect(validate(dto, strictValidation)).resolves.toEqual([]);
  });

  it.each([
    { page: '1', limit: '1', expectedPage: 1, expectedLimit: 1 },
    { page: '002', limit: '050', expectedPage: 2, expectedLimit: 50 },
    {
      page: String(Number.MAX_SAFE_INTEGER),
      limit: '100',
      expectedPage: Number.MAX_SAFE_INTEGER,
      expectedLimit: 100,
    },
  ])(
    'transforms page=$page and limit=$limit without broad numeric coercion',
    async ({ page, limit, expectedPage, expectedLimit }) => {
      const dto = plainToInstance(OffsetPaginationQueryDto, { page, limit });
      expect(dto).toMatchObject({ page: expectedPage, limit: expectedLimit });
      await expect(validate(dto, strictValidation)).resolves.toEqual([]);
    },
  );

  it.each([
    '0',
    '-1',
    '1.5',
    '1.0',
    '1e2',
    '0x10',
    '+1',
    ' 1 ',
    '',
    'invalid',
    String(Number.MAX_SAFE_INTEGER + 1),
    '9'.repeat(400),
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    null,
    true,
    ['1'],
    {},
  ])('rejects invalid page=%j', async (page) => {
    const errors = await validate(
      plainToInstance(OffsetPaginationQueryDto, { page }),
      strictValidation,
    );
    expect(errors.map(({ property }) => property)).toContain('page');
  });

  it.each([
    '0',
    '-1',
    '101',
    '1.1',
    '1e2',
    '0x10',
    '',
    ' 1 ',
    null,
    true,
    ['1'],
    {},
  ])('preserves strict limit validation for %j', async (limit) => {
    const errors = await validate(
      plainToInstance(OffsetPaginationQueryDto, { limit }),
      strictValidation,
    );
    expect(errors.map(({ property }) => property)).toContain('limit');
  });

  it.each(['asc', 'desc'])(
    'allows createdAt ordering and %s direction',
    async (sortOrder) => {
      await expect(
        validate(
          plainToInstance(OffsetPaginationQueryDto, {
            sortBy: 'createdAt',
            sortOrder,
          }),
          strictValidation,
        ),
      ).resolves.toEqual([]);
    },
  );

  it.each([
    { sortBy: 'name' },
    { sortBy: 'password' },
    { sortBy: null },
    { sortOrder: 'ASC' },
    { sortOrder: ['asc'] },
    { sortOrder: null },
    { cursor: 'YQ' },
    { skip: '1' },
    { take: '1' },
    { offset: '1' },
  ])(
    'rejects fields outside the standalone page contract: %j',
    async (input) => {
      const errors = await validate(
        plainToInstance(OffsetPaginationQueryDto, input),
        strictValidation,
      );
      expect(errors.map(({ property }) => property)).toContain(
        Object.keys(input)[0],
      );
    },
  );
});
