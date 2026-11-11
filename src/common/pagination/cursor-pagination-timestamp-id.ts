import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export interface CursorPaginationTimestampId {
  id: string;
  createdAt: Date;
}

export function encodeCursorPaginationTimestampId(
  item: CursorPaginationTimestampId,
): string {
  return Buffer.from(
    JSON.stringify({ id: item.id, createdAt: item.createdAt.toISOString() }),
  ).toString('base64url');
}

export function decodeCursorPaginationTimestampId(
  cursor: string,
): CursorPaginationTimestampId {
  if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
    throw new BadRequestException('Invalid pagination cursor');
  }

  const buffer = Buffer.from(cursor, 'base64url');
  if (buffer.toString('base64url') !== cursor) {
    throw new BadRequestException('Invalid pagination cursor');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(buffer.toString('utf8'));
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new BadRequestException('Invalid pagination cursor');
    }
    throw error;
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Object.keys(payload).length !== 2 ||
    !('id' in payload) ||
    !('createdAt' in payload) ||
    typeof payload.id !== 'string' ||
    !isUUID(payload.id) ||
    typeof payload.createdAt !== 'string' ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
      payload.createdAt,
    )
  ) {
    throw new BadRequestException('Invalid pagination cursor');
  }

  const createdAt = new Date(payload.createdAt);
  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== payload.createdAt
  ) {
    throw new BadRequestException('Invalid pagination cursor');
  }

  return { id: payload.id, createdAt };
}
