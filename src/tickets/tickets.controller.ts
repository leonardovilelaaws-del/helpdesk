import { Controller, Post } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket-dto';
import { ApiCookieAuth } from '@nestjs/swagger';
import { RequireRole } from '../authorization/decorators/require-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiCookieAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @RequireRole('ADMIN')
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    createTicketDto: CreateTicketDto,
  ) {
    return await this.ticketsService.createTicket(user.id, createTicketDto);
  }
}
