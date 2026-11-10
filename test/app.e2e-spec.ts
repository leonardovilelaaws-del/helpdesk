import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app/app.module';
import { configureApp } from '../src/app/configure-app';
import type { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Autenticação (e2e)', () => {
  let app: INestApplication;
  let sessionId: string | undefined;
  const origin = process.env.CORS_ORIGINS!.split(',')[0].trim();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    try {
      if (sessionId) {
        await app.get(PrismaService).refreshSession.deleteMany({
          where: { id: sessionId },
        });
      }
    } finally {
      await app?.close();
    }
  });

  it('recusa uma rota protegida sem login', async () => {
    await request(app.getHttpServer()).get('/').expect(401);
  });

  it('faz login com o ADMIN da seed e consulta /auth/me', async () => {
    const admin = request.agent(app.getHttpServer());
    const login = await admin
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email: 'admin@helpdesk.test', password: 'Admin@123456' })
      .expect(200);
    const user = login.body as AuthenticatedUser;
    sessionId = user.sessionId;

    expect(user).toMatchObject({
      email: 'admin@helpdesk.test',
      roles: ['ADMIN'],
    });
    await admin.get('/auth/me').expect(200).expect(user);
  });
});
