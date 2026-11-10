import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket-dto';
import { ResponseTicketDto } from './dto/response-ticket-dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(
    userId: string,
    createTicketDto: CreateTicketDto,
  ): Promise<ResponseTicketDto> {
    return await this.prisma.ticket.create({
      data: {
        ...createTicketDto,
        user_requester_id: userId,
      },
    });
  }

  async findOne(id: string): Promise<ResponseTicketDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: {
        id: id,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }
}
