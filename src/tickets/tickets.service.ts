import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket-dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(
    userId: string,
    createTicketDto: CreateTicketDto,
  ) {
    return await this.prisma.ticket.create({
      data: {
        ...createTicketDto,
        user_requester_id: userId,
      },
    });
  }
}
