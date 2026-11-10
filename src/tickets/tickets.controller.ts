import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket-dto';
import { ApiCookieAuth } from '@nestjs/swagger';
import { RequireRole } from '../authorization/decorators/require-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ResponseTicketDto } from './dto/response-ticket-dto';
import { RequirePermissions } from '../authorization/decorators/require-permissions.decorator';

@ApiCookieAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @RequireRole('REQUESTER')
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createTicketDto: CreateTicketDto,
  ): Promise<ResponseTicketDto> {
    return await this.ticketsService.createTicket(user.id, createTicketDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResponseTicketDto> {
    return this.ticketsService.findOne(id);
  }
}
