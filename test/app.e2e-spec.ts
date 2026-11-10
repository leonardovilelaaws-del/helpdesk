import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { configureApp } from '../src/app/configure-app';
import { AuthService } from '../src/auth/auth.service';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import { TicketsService } from '../src/tickets/tickets.service';

describe('Application authentication and authorization (e2e)', () => {
  let app: INestApplication;
  const origin = 'http://localhost:5173';
  const admin: AuthenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Admin',
    email: 'admin@example.test',
    roles: ['ADMIN'],
    permissions: [],
    sessionId: '22222222-2222-4222-8222-222222222222',
  };
  const member: AuthenticatedUser = { ...admin, roles: ['MEMBER'] };
  const dto = {
    subject: 'Printer offline',
    description: 'Cannot print invoices',
  };
  const authenticate = jest.fn<
    ReturnType<AuthService['authenticate']>,
    Parameters<AuthService['authenticate']>
  >();
  const login = jest.fn<
    ReturnType<AuthService['login']>,
    Parameters<AuthService['login']>
  >();
  const createTicket = jest.fn<
    ReturnType<TicketsService['createTicket']>,
    Parameters<TicketsService['createTicket']>
  >();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        permission: { createMany: jest.fn(async () => ({ count: 0 })) },
      })
      .overrideProvider(AuthService)
      .useValue({ authenticate, login })
      .overrideProvider(TicketsService)
      .useValue({ createTicket })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockImplementation(async (token) => {
      if (token === 'admin-token') return admin;
      if (token === 'member-token') return member;
      throw new UnauthorizedException();
    });
    createTicket.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      ...dto,
      status: 'OPEN',
      user_requester_id: admin.id,
      user_agent_id: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects ticket creation without an access cookie', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Origin', origin)
      .send(dto)
      .expect(401);

    expect(authenticate).not.toHaveBeenCalled();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('rejects an invalid access cookie', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Origin', origin)
      .set('Cookie', 'access_token=invalid-token')
      .send(dto)
      .expect(401);

    expect(authenticate).toHaveBeenCalledWith('invalid-token');
    expect(createTicket).not.toHaveBeenCalled();
  });

  it('authenticates an admin and passes the request body to ticket creation', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Origin', origin)
      .set('Cookie', 'access_token=admin-token')
      .send(dto)
      .expect(201);

    expect(authenticate).toHaveBeenCalledWith('admin-token');
    expect(createTicket).toHaveBeenCalledWith(admin.id, dto);
  });

  it('enforces @RequireRole for an authenticated non-admin', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Origin', origin)
      .set('Cookie', 'access_token=member-token')
      .send(dto)
      .expect(403);

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('validates the ticket body after authenticating an admin', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Origin', origin)
      .set('Cookie', 'access_token=admin-token')
      .send({ subject: '', description: 123 })
      .expect(400);

    expect(createTicket).not.toHaveBeenCalled();
  });

  it('enforces the controller-level @Roles requirement', async () => {
    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Cookie', 'access_token=member-token')
      .expect(403);
  });

  it('allows an admin through the controller-level @Roles requirement', async () => {
    await request(app.getHttpServer())
      .get('/admin/dashboard')
      .set('Cookie', 'access_token=admin-token')
      .expect(200)
      .expect({ message: 'Administration access granted' });
  });

  it('keeps unmarked routes protected by default', async () => {
    await request(app.getHttpServer()).get('/').expect(401);
  });

  it('allows public login without an existing access cookie', async () => {
    login.mockResolvedValue({
      accessToken: 'admin-token',
      refreshToken: 'refresh-token',
      accessExpiresIn: 900,
      expiresAt: new Date(Date.now() + 86_400_000),
      user: admin,
    });
    const credentials = { email: admin.email, password: 'test-password' };

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(200)
      .expect(admin);

    expect(login).toHaveBeenCalledWith(credentials);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
