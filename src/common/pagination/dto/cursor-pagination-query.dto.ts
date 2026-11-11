import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { Prisma } from '../../../generated/prisma/client';
import { MAX_CURSOR_PAGINATION_TOKEN_LENGTH } from '../cursor-pagination-token';

export class CursorPaginationQueryDto<TField extends string = 'createdAt'> {
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @ValidateIf(
    (_object: unknown, value: unknown): boolean => value !== undefined,
  )
  @IsIn(['asc', 'desc'])
  sortOrder?: Prisma.SortOrder;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
  @ApiPropertyOptional({ enum: ['createdAt'], default: 'createdAt' })
  @ValidateIf(
    (_object: unknown, value: unknown): boolean => value !== undefined,
  )
  @IsIn(['createdAt'])
  sortBy?: TField;

  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: MAX_CURSOR_PAGINATION_TOKEN_LENGTH,
    pattern: '^[A-Za-z0-9_-]+$',
    description:
      'Cursor opaco de meta.nextCursor. Omita na primeira página; mantenha filtros e ordenação ao continuar.',
  })
  @ValidateIf(
    (_object: unknown, value: unknown): boolean => value !== undefined,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CURSOR_PAGINATION_TOKEN_LENGTH)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;
}
