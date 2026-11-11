import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import type { Prisma } from '../../../generated/prisma/client';

export class OffsetPaginationQueryDto<TField extends string = 'createdAt'> {
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
    type: 'integer',
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
    description:
      'Número da página, iniciando em 1. O offset calculado também deve ser um inteiro seguro.',
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page: number = 1;
}
