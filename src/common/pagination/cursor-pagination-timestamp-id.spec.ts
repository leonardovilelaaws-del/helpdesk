import { BadRequestException } from '@nestjs/common';
import {
  decodeCursorPaginationTimestampId,
  encodeCursorPaginationTimestampId,
} from './cursor-pagination-timestamp-id';

describe('timestamp and ID cursor', () => {
  const item = {
    id: '5e5818b9-c460-4ef3-bef8-d810a5abe17f',
    createdAt: new Date('2026-11-05T12:00:00.123Z'),
  };
  const payload = { id: item.id, createdAt: item.createdAt.toISOString() };

  function encodeCursorPaginationPayload(value: unknown): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  it('round-trips a UUID and a timestamp including milliseconds', () => {
    const cursor = encodeCursorPaginationTimestampId(item);

    expect(decodeCursorPaginationTimestampId(cursor)).toEqual(item);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain('=');
    expect(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    ).toEqual(payload);
  });

  it.each(['0001-01-01T00:00:00.000Z', '9999-12-31T23:59:59.999Z'])(
    'accepts a supported boundary timestamp: %s',
    (createdAt) => {
      const boundaryItem = { id: item.id, createdAt: new Date(createdAt) };

      expect(
        decodeCursorPaginationTimestampId(
          encodeCursorPaginationTimestampId(boundaryItem),
        ),
      ).toEqual(boundaryItem);
    },
  );

  it.each([
    ['empty', ''],
    ['invalid alphabet', 'not+a/cursor'],
    ['whitespace', ` ${encodeCursorPaginationPayload(payload)}`],
    ['padding', `${encodeCursorPaginationPayload(payload)}=`],
    ['noncanonical base64url', 'a'],
    [
      'more than 512 characters',
      Buffer.from(JSON.stringify(payload).padEnd(400, ' '), 'utf8').toString(
        'base64url',
      ),
    ],
    [
      'invalid JSON',
      Buffer.from('{invalid-json', 'utf8').toString('base64url'),
    ],
    ['null JSON', encodeCursorPaginationPayload(null)],
    ['array JSON', encodeCursorPaginationPayload([payload])],
    ['string JSON', encodeCursorPaginationPayload('cursor')],
    ['number JSON', encodeCursorPaginationPayload(42)],
    [
      'missing ID',
      encodeCursorPaginationPayload({ createdAt: payload.createdAt }),
    ],
    ['missing timestamp', encodeCursorPaginationPayload({ id: payload.id })],
    ['non-string ID', encodeCursorPaginationPayload({ ...payload, id: 42 })],
    [
      'invalid UUID',
      encodeCursorPaginationPayload({ ...payload, id: 'not-a-uuid' }),
    ],
    [
      'non-string timestamp',
      encodeCursorPaginationPayload({ ...payload, createdAt: 42 }),
    ],
    [
      'invalid timestamp',
      encodeCursorPaginationPayload({ ...payload, createdAt: 'invalid' }),
    ],
    [
      'nonexistent calendar date',
      encodeCursorPaginationPayload({
        ...payload,
        createdAt: '2026-02-30T00:00:00.000Z',
      }),
    ],
    [
      'timestamp without milliseconds',
      encodeCursorPaginationPayload({
        ...payload,
        createdAt: '2026-11-05T12:00:00Z',
      }),
    ],
    [
      'noncanonical time zone',
      encodeCursorPaginationPayload({
        ...payload,
        createdAt: '2026-11-05T08:00:00.123-04:00',
      }),
    ],
    [
      'year zero',
      encodeCursorPaginationPayload({
        ...payload,
        createdAt: '0000-01-01T00:00:00.000Z',
      }),
    ],
    [
      'a negative year',
      encodeCursorPaginationPayload({
        ...payload,
        createdAt: '-100000-01-01T00:00:00.000Z',
      }),
    ],
    [
      'a year greater than 9999',
      encodeCursorPaginationPayload({
        ...payload,
        createdAt: '+010000-01-01T00:00:00.000Z',
      }),
    ],
    ['extra field', encodeCursorPaginationPayload({ ...payload, limit: 20 })],
  ])('rejects a cursor containing %s', (_description, cursor) => {
    expect(() => decodeCursorPaginationTimestampId(cursor)).toThrow(
      BadRequestException,
    );
  });
});
