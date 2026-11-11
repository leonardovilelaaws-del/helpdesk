import { Module } from '@nestjs/common';
import { CursorPaginationService } from './cursor-pagination.service';
import { OffsetPaginationService } from './offset-pagination.service';

@Module({
  providers: [CursorPaginationService, OffsetPaginationService],
  exports: [CursorPaginationService, OffsetPaginationService],
})
export class PaginationModule {}
