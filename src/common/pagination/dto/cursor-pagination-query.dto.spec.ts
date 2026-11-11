import { plainToInstance } from 'class-transformer';
import { IsString, validate } from 'class-validator';
import { CursorPaginationQueryDto } from './cursor-pagination-query.dto';

describe('CursorPaginationQueryDto', () => {
  it('defaults to twenty items without a cursor', async () => {
    const dto = plainToInstance(CursorPaginationQueryDto, {});

    expect(dto.limit).toBe(20);
    expect(dto.cursor).toBeUndefined();
    expect(dto.sortBy).toBeUndefined();
    expect(dto.sortOrder).toBeUndefined();
    expect(dto).not.toHaveProperty('page');
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    { value: '1', expected: 1 },
    { value: '050', expected: 50 },
    { value: '100', expected: 100 },
  ])('converts decimal limit=$value', async ({ value, expected }) => {
    const dto = plainToInstance(CursorPaginationQueryDto, { limit: value });

    expect(dto.limit).toBe(expected);
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    '0',
    '-1',
    '1.5',
    '1e2',
    '0x10',
    '+1',
    ' 1 ',
    '',
    'invalid',
    '101',
    0,
    -1,
    1.5,
    null,
    true,
    ['1'],
    {},
  ])('rejects an invalid limit: %j', async (limit) => {
    const dto = plainToInstance(CursorPaginationQueryDto, { limit });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('limit');
  });

  it('accepts an opaque canonical base64url cursor without interpreting the payload', async () => {
    const cursor = Buffer.from('product:BOOK-001').toString('base64url');
    const dto = plainToInstance(CursorPaginationQueryDto, { cursor });

    expect(dto.cursor).toBe(cursor);
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    '',
    ' ',
    'abc=',
    'abc+',
    'abc/',
    'a'.repeat(4097),
    null,
    true,
    42,
    ['YQ'],
    {},
  ])('rejects an invalid cursor: %j', async (cursor) => {
    const dto = plainToInstance(CursorPaginationQueryDto, { cursor });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('cursor');
  });

  it.each(['asc', 'desc'])(
    'allows its default public sort field in %s order',
    async (sortOrder) => {
      const dto = plainToInstance(CursorPaginationQueryDto, {
        sortBy: 'createdAt',
        sortOrder,
      });
      await expect(validate(dto)).resolves.toEqual([]);
    },
  );

  it.each(['name', 'password', 'tasks', '', null, ['createdAt'], {}])(
    'rejects sortBy=%j outside the default DTO whitelist',
    async (sortBy) => {
      const errors = await validate(
        plainToInstance(CursorPaginationQueryDto, { sortBy }),
      );
      expect(errors.map(({ property }) => property)).toContain('sortBy');
    },
  );

  it.each(['ASC', 'descending', '', null, 1, ['asc'], {}])(
    'rejects invalid sortOrder=%j',
    async (sortOrder) => {
      const errors = await validate(
        plainToInstance(CursorPaginationQueryDto, { sortOrder }),
      );
      expect(errors.map(({ property }) => property)).toContain('sortOrder');
    },
  );

  it('forbids the removed page parameter and other unexpected properties', async () => {
    const dto = plainToInstance(CursorPaginationQueryDto, {
      page: '2',
      offset: '1',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property).sort()).toEqual([
      'offset',
      'page',
    ]);
  });

  it('allows another module to inherit defaults, transforms and validation', async () => {
    class UserQueryDto extends CursorPaginationQueryDto {
      @IsString()
      email: string;
    }
    const dto = plainToInstance(UserQueryDto, {
      limit: '2',
      email: 'alice@example.com',
    });

    expect(dto).toMatchObject({ limit: 2, email: 'alice@example.com' });
    await expect(validate(dto)).resolves.toEqual([]);

    dto.limit = 0;
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('limit');
  });
});
