import { BadRequestException } from '@nestjs/common';
import {
  decodeCursorPaginationToken,
  encodeCursorPaginationToken,
  isCursorPaginationScalar,
  MAX_CURSOR_PAGINATION_TOKEN_LENGTH,
  type CursorPaginationOrder,
  type CursorPaginationScalar,
  type CursorPaginationScalarType,
} from './cursor-pagination-token';
import { encodeCursorPaginationTimestampId } from './cursor-pagination-timestamp-id';

const id = '5e5818b9-c460-4ef3-bef8-d810a5abe17f';
const otherId = '0eb6a729-02b7-4a59-9310-49f72aa38a53';
const nameOrder: CursorPaginationOrder = { field: 'name', direction: 'asc' };
const namePayload = {
  v: 2,
  field: 'name',
  direction: 'asc',
  type: 'string',
  value: 'Estudar',
  id,
};

function encodeCursorPaginationPayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

describe('dynamic pagination cursor', () => {
  it.each<{
    field: string;
    value: CursorPaginationScalar;
    type: CursorPaginationScalarType;
  }>([
    { field: 'name', value: 'Estudar', type: 'string' },
    { field: 'name', value: '', type: 'string' },
    { field: 'name', value: '🚀'.repeat(150), type: 'string' },
    { field: 'name', value: 'ação 中文 "texto" \\ linha\n', type: 'string' },
    { field: 'completed', value: false, type: 'boolean' },
    { field: 'completed', value: true, type: 'boolean' },
    { field: 'score', value: 0, type: 'number' },
    { field: 'score', value: -42.125, type: 'number' },
    { field: 'score', value: 1.25e25, type: 'number' },
    {
      field: 'createdAt',
      value: new Date('2026-11-05T12:00:00.123Z'),
      type: 'date',
    },
    {
      field: 'createdAt',
      value: new Date('0001-01-01T00:00:00.000Z'),
      type: 'date',
    },
    {
      field: 'createdAt',
      value: new Date('9999-12-31T23:59:59.999Z'),
      type: 'date',
    },
  ])('round-trips $field with $type value $value', ({ field, value, type }) => {
    for (const direction of ['asc', 'desc'] as const) {
      const order = { field, direction };
      const token = encodeCursorPaginationToken({ ...order, value, id });
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeLessThanOrEqual(
        MAX_CURSOR_PAGINATION_TOKEN_LENGTH,
      );
      expect(Buffer.from(token, 'base64url').toString('base64url')).toBe(token);
      expect(decodeCursorPaginationToken(token, order)).toEqual({
        ...order,
        value,
        id,
      });
      const payload: unknown = JSON.parse(
        Buffer.from(token, 'base64url').toString('utf8'),
      );
      expect(payload).toEqual({
        v: 2,
        ...order,
        type,
        value: value instanceof Date ? value.toISOString() : value,
        id,
      });
    }
  });

  it.each([
    ['empty token', ''],
    ['invalid alphabet', 'not+a/cursor'],
    ['whitespace', ` ${encodeCursorPaginationPayload(namePayload)}`],
    ['padding', `${encodeCursorPaginationPayload(namePayload)}=`],
    ['noncanonical base64url', 'AB'],
    ['oversized token', 'a'.repeat(MAX_CURSOR_PAGINATION_TOKEN_LENGTH + 1)],
    ['invalid JSON', Buffer.from('{invalid-json').toString('base64url')],
    [
      'invalid UTF-8 inside a JSON string',
      Buffer.concat([
        Buffer.from(
          '{"v":2,"field":"name","direction":"asc","type":"string","value":"',
        ),
        Buffer.from([0xff]),
        Buffer.from(`","id":"${id}"}`),
      ]).toString('base64url'),
    ],
    ['null JSON', encodeCursorPaginationPayload(null)],
    ['array JSON', encodeCursorPaginationPayload([namePayload])],
    ['string JSON', encodeCursorPaginationPayload('cursor')],
    ['number JSON', encodeCursorPaginationPayload(42)],
    ['empty object', encodeCursorPaginationPayload({})],
    [
      'unsupported version',
      encodeCursorPaginationPayload({ ...namePayload, v: 3 }),
    ],
    [
      'string version',
      encodeCursorPaginationPayload({ ...namePayload, v: '2' }),
    ],
    [
      'additional field',
      encodeCursorPaginationPayload({ ...namePayload, limit: 20 }),
    ],
    [
      'missing ID',
      encodeCursorPaginationPayload({
        v: 2,
        field: 'name',
        direction: 'asc',
        type: 'string',
        value: 'Estudar',
      }),
    ],
    ['null ID', encodeCursorPaginationPayload({ ...namePayload, id: null })],
    ['numeric ID', encodeCursorPaginationPayload({ ...namePayload, id: 42 })],
    [
      'invalid UUID',
      encodeCursorPaginationPayload({ ...namePayload, id: 'not-a-uuid' }),
    ],
    [
      'missing value',
      encodeCursorPaginationPayload({
        v: 2,
        field: 'name',
        direction: 'asc',
        type: 'string',
        id,
      }),
    ],
    [
      'null value',
      encodeCursorPaginationPayload({ ...namePayload, value: null }),
    ],
    [
      'array value',
      encodeCursorPaginationPayload({ ...namePayload, value: ['Estudar'] }),
    ],
    [
      'object value',
      encodeCursorPaginationPayload({
        ...namePayload,
        value: { text: 'Estudar' },
      }),
    ],
    [
      'unknown type',
      encodeCursorPaginationPayload({ ...namePayload, type: 'bigint' }),
    ],
    [
      'inconsistent string tag',
      encodeCursorPaginationPayload({ ...namePayload, value: 123 }),
    ],
    [
      'inconsistent number tag',
      encodeCursorPaginationPayload({ ...namePayload, type: 'number' }),
    ],
    [
      'inconsistent Boolean tag',
      encodeCursorPaginationPayload({ ...namePayload, type: 'boolean' }),
    ],
    [
      'numeric Boolean',
      encodeCursorPaginationPayload({
        ...namePayload,
        type: 'boolean',
        value: 0,
      }),
    ],
    [
      'missing type',
      encodeCursorPaginationPayload({
        v: 2,
        field: 'name',
        direction: 'asc',
        value: 'Estudar',
        id,
      }),
    ],
    [
      'null field',
      encodeCursorPaginationPayload({ ...namePayload, field: null }),
    ],
    [
      'uppercase direction',
      encodeCursorPaginationPayload({ ...namePayload, direction: 'ASC' }),
    ],
  ])('rejects %s', (_label, token) => {
    expect(() => decodeCursorPaginationToken(token, nameOrder)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    'yesterday',
    '2026-02-30T00:00:00.000Z',
    '2026-11-05T12:00:00Z',
    '2026-11-05T08:00:00.123-04:00',
    '0000-01-01T00:00:00.000Z',
    '-100000-01-01T00:00:00.000Z',
    '+010000-01-01T00:00:00.000Z',
    123,
    null,
  ])('rejects noncanonical date %s', (value) => {
    const order: CursorPaginationOrder = {
      field: 'createdAt',
      direction: 'desc',
    };
    const token = encodeCursorPaginationPayload({
      ...namePayload,
      ...order,
      type: 'date',
      value,
    });
    expect(() => decodeCursorPaginationToken(token, order)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    { field: 'name', direction: 'desc' },
    { field: 'createdAt', direction: 'asc' },
    { field: 'completed', direction: 'asc' },
  ] satisfies CursorPaginationOrder[])(
    'rejects a cursor reused with $field $direction',
    (order) => {
      expect(() =>
        decodeCursorPaginationToken(
          encodeCursorPaginationPayload(namePayload),
          order,
        ),
      ).toThrow(BadRequestException);
    },
  );

  it('requires the value and ID to match when sorting directly by ID', () => {
    const order: CursorPaginationOrder = { field: 'id', direction: 'desc' };
    const token = encodeCursorPaginationToken({ ...order, value: id, id });
    expect(decodeCursorPaginationToken(token, order)).toEqual({
      ...order,
      value: id,
      id,
    });
    const mismatched = encodeCursorPaginationPayload({
      ...namePayload,
      ...order,
      value: otherId,
    });
    expect(() => decodeCursorPaginationToken(mismatched, order)).toThrow(
      BadRequestException,
    );
  });

  it('accepts legacy timestamps only with the original descending order', () => {
    const createdAt = new Date('2026-11-05T12:00:00.123Z');
    const token = encodeCursorPaginationTimestampId({ id, createdAt });
    const order: CursorPaginationOrder = {
      field: 'createdAt',
      direction: 'desc',
    };
    expect(decodeCursorPaginationToken(token, order)).toEqual({
      ...order,
      id,
      value: createdAt,
    });
    for (const incompatible of [
      { field: 'createdAt', direction: 'asc' },
      { field: 'name', direction: 'desc' },
    ] satisfies CursorPaginationOrder[]) {
      expect(() => decodeCursorPaginationToken(token, incompatible)).toThrow(
        BadRequestException,
      );
    }
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    new Date('invalid'),
    new Date('0000-01-01T00:00:00.000Z'),
    new Date('+010000-01-01T00:00:00.000Z'),
  ])('rejects an unsupported encoder scalar %s', (value) => {
    expect(() =>
      encodeCursorPaginationToken({ ...nameOrder, value, id }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid IDs while encoding', () => {
    expect(() =>
      encodeCursorPaginationToken({
        ...nameOrder,
        value: 'Estudar',
        id: 'invalid',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a cursor whose scalar exceeds the token size limit', () => {
    expect(() =>
      encodeCursorPaginationToken({
        ...nameOrder,
        value: 'x'.repeat(MAX_CURSOR_PAGINATION_TOKEN_LENGTH),
        id,
      }),
    ).toThrow(BadRequestException);
  });

  it.each([null, undefined, [], {}, 1n])(
    'does not classify %s as a supported scalar',
    (value) => {
      expect(isCursorPaginationScalar(value)).toBe(false);
    },
  );

  it('treats a valid modified value as a new boundary because tokens are unsigned', () => {
    const token = encodeCursorPaginationPayload({
      ...namePayload,
      value: 'Outra posição válida',
    });
    expect(decodeCursorPaginationToken(token, nameOrder)).toEqual({
      ...nameOrder,
      value: 'Outra posição válida',
      id,
    });
  });
});
