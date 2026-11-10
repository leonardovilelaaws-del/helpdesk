import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { configureApp } from '../src/app/configure-app';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import type { ResponseTicketDto } from '../src/tickets/dto/response-ticket-dto';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let requester: ReturnType<typeof request.agent>;
  const sessionIds: string[] = [];
  const ticketIds: string[] = [];
  const origin = process.env.CORS_ORIGINS!.split(',')[0].trim();
  let user: AuthenticatedUser;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // A seed já criou o REQUESTER. O Supertest guarda os cookies do login.
    requester = request.agent(app.getHttpServer());
    const login = await requester
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email: 'requester@helpdesk.test', password: 'Requester@123456' })
      .expect(200);
    user = login.body as AuthenticatedUser;
    sessionIds.push(user.sessionId);
    expect(user.roles).toContain('REQUESTER');
  });

  afterAll(async () => {
    try {
      if (ticketIds.length > 0) {
        await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      }
      if (sessionIds.length > 0) {
        await prisma.refreshSession.deleteMany({
          where: { id: { in: sessionIds } },
        });
      }
    } finally {
      await app?.close();
    }
  });

  const createTicket = async () => {
    const dto = {
      subject: 'Impressora sem conexão',
      description: 'A impressora não aparece na rede.',
    };

    // Reutiliza os cookies do login feito no beforeAll.
    const response = await requester
      .post('/tickets')
      .set('Origin', origin)
      .send(dto)
      .expect(201);

    const ticket = response.body as ResponseTicketDto;
    ticketIds.push(ticket.id);
    return {
      ticket,
      dto,
    };
  };

  it('POST /tickets cria um ticket com o REQUESTER da seed', async () => {
    const response = await createTicket();

    const expected = {
      ...response.dto,
      user_requester_id: user.id,
      status: 'OPEN',
    };
    expect(response.ticket).toMatchObject({
      id: expect.any(String),
      ...expected,
    });
    expect(
      await prisma.ticket.findUnique({ where: { id: response.ticket.id } }),
    ).toMatchObject(expected);
  });

  it('POST /tickets recusa o AGENT porque a rota exige REQUESTER', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email: 'agent@helpdesk.test', password: 'Agent@123456' })
      .expect(200);
    const agentUser = login.body as AuthenticatedUser;
    sessionIds.push(agentUser.sessionId);

    await agent
      .post('/tickets')
      .set('Origin', origin)
      .send({
        subject: 'Impressora sem conexão',
        description: 'A impressora não aparece na rede.',
      })
      .expect(403);
  });

  it('GET /tickets/:id return unique ticket', async () => {
    const responseCreateTicket = await createTicket();

    const response = await requester
      .get(`/tickets/${responseCreateTicket.ticket.id}`)
      .set('Origin', origin)
      .expect(200);
    expect(response.body as ResponseTicketDto).toEqual(
      responseCreateTicket.ticket,
    );
  });
});
