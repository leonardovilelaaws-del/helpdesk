import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';
import { decodeCursorPaginationTimestampId } from './cursor-pagination-timestamp-id';

export const MAX_CURSOR_PAGINATION_TOKEN_LENGTH = 4096;
export type CursorPaginationScalar = string | number | boolean | Date;
export type CursorPaginationScalarType =
  'string' | 'number' | 'boolean' | 'date';

export interface CursorPaginationOrder {
  field: string;
  direction: Prisma.SortOrder;
}

export interface CursorPaginationPosition extends CursorPaginationOrder {
  value: CursorPaginationScalar;
  id: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCursorPaginationScalar(
  value: unknown,
): value is CursorPaginationScalar {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (value instanceof Date &&
      Number.isFinite(value.getTime()) &&
      value.getUTCFullYear() >= 1 &&
      value.getUTCFullYear() <= 9999)
  );
}

export function getCursorPaginationScalarType(
  value: CursorPaginationScalar,
): CursorPaginationScalarType {
  if (value instanceof Date) return 'date';
  if (typeof value === 'string') return 'string';
  return typeof value === 'number' ? 'number' : 'boolean';
}

export function encodeCursorPaginationToken(
  cursor: CursorPaginationPosition,
): string {
  const { field, direction, value, id } = cursor;
  if (!isUUID(id) || !isCursorPaginationScalar(value)) {
    throw new BadRequestException('Unsupported pagination cursor value');
  }
  const token = Buffer.from(
    JSON.stringify({
      v: 2,
      field,
      direction,
      type: getCursorPaginationScalarType(value),
      value: value instanceof Date ? value.toISOString() : value,
      id,
    }),
  ).toString('base64url');
  if (token.length > MAX_CURSOR_PAGINATION_TOKEN_LENGTH) {
    throw new BadRequestException('Pagination sort value is too large');
  }
  return token;
}

export function decodeCursorPaginationToken(
  token: string,
  order: CursorPaginationOrder,
): CursorPaginationPosition {
  const invalid = (): never => {
    throw new BadRequestException('Invalid or incompatible pagination cursor');
  };
  if (
    typeof token !== 'string' ||
    token.length > MAX_CURSOR_PAGINATION_TOKEN_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return invalid();
  }
  const bytes = Buffer.from(token, 'base64url');
  if (bytes.toString('base64url') !== token) return invalid();
  const json = bytes.toString('utf8');
  if (!Buffer.from(json, 'utf8').equals(bytes)) return invalid();

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return invalid();
  }
  if (!isRecord(payload)) return invalid();

  // Old tokens are only meaningful for the original descending timestamp order.
  if (!('v' in payload)) {
    if (order.field !== 'createdAt' || order.direction !== 'desc') {
      return invalid();
    }
    const legacy = decodeCursorPaginationTimestampId(token);
    return { ...order, id: legacy.id, value: legacy.createdAt };
  }

  if (
    Object.keys(payload).length !== 6 ||
    payload.v !== 2 ||
    payload.field !== order.field ||
    payload.direction !== order.direction ||
    typeof payload.id !== 'string' ||
    !isUUID(payload.id)
  ) {
    return invalid();
  }

  let value: CursorPaginationScalar;
  if (payload.type === 'date') {
    if (
      typeof payload.value !== 'string' ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
        payload.value,
      )
    ) {
      return invalid();
    }
    value = new Date(payload.value);
    if (
      !isCursorPaginationScalar(value) ||
      value.toISOString() !== payload.value
    ) {
      return invalid();
    }
  } else if (
    (payload.type === 'string' && typeof payload.value === 'string') ||
    (payload.type === 'boolean' && typeof payload.value === 'boolean') ||
    (payload.type === 'number' &&
      typeof payload.value === 'number' &&
      Number.isFinite(payload.value))
  ) {
    value = payload.value;
  } else {
    return invalid();
  }

  if (order.field === 'id' && value !== payload.id) return invalid();
  return { ...order, id: payload.id, value };
}
