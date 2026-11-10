import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from './tickets.service';
import { ResponseTicketDto } from './dto/response-ticket-dto';
import { Prisma, TicketStatus } from '../generated/prisma/client';
import { CreateTicketDto } from './dto/create-ticket-dto';

interface TicketDelegateMock {
  create: jest.Mock<Promise<ResponseTicketDto>, [Prisma.TicketCreateArgs]>;
  findUnique: jest.Mock<
    Promise<ResponseTicketDto>,
    [Prisma.TicketWhereUniqueInput]
  >;
}

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketDelegate: TicketDelegateMock;

  const responseTicketDto: ResponseTicketDto = {
    id: '5e5818b9-c460-4ef3-bef8-d810a5abe17f',
    subject: 'Write service tests',
    description: 'Cover Task CRUD behavior.',
    status: TicketStatus.OPEN,
    user_requester_id: 'd6c3cbfb-b8a7-469c-a885-cc1c0be5c16d',
    user_agent_id: null,
    createdAt: new Date('2026-11-05T12:00:00.000Z'),
    updatedAt: new Date('2026-11-05T12:00:00.000Z'),
  };

  const createTicketDto: CreateTicketDto = {
    subject: responseTicketDto.subject,
    description: responseTicketDto.description,
  };

  beforeEach(async () => {
    ticketDelegate = {
      create: jest.fn<Promise<ResponseTicketDto>, [Prisma.TicketCreateArgs]>(),
      findUnique: jest.fn<
        Promise<ResponseTicketDto>,
        [Prisma.TicketWhereUniqueInput]
      >(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: { ticket: ticketDelegate } },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should be create a ticket', async () => {
    ticketDelegate.create.mockResolvedValue(responseTicketDto);

    await expect(
      service.createTicket(
        responseTicketDto.user_requester_id,
        createTicketDto,
      ),
    ).resolves.toEqual(responseTicketDto);

    expect(ticketDelegate.create).toHaveBeenCalledWith({
      data: {
        subject: createTicketDto.subject,
        description: createTicketDto.description,
        user_requester_id: 'd6c3cbfb-b8a7-469c-a885-cc1c0be5c16d',
      },
    });

    expect(ticketDelegate.create).toHaveBeenCalledTimes(1);
  });

  it('finds a ticket by its ID', async () => {
    ticketDelegate.findUnique.mockResolvedValue(responseTicketDto);

    await expect(service.findOne(responseTicketDto.id)).resolves.toBe(
      responseTicketDto,
    );

    expect(ticketDelegate.findUnique).toHaveBeenCalledTimes(1);
    expect(ticketDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: responseTicketDto.id },
    });
  });
});
