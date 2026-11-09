import { PrismaPg } from '@prisma/adapter-pg';
import { argon2id, hash } from 'argon2';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const profiles = [
  {
    role: 'ADMIN',
    description: 'Gerencia usuários, permissões e tickets',
    name: 'Administrador Teste',
    email: 'admin@helpdesk.test',
    password: 'Admin@123456',
  },
  {
    role: 'REQUESTER',
    description: 'Abre tickets e acompanha suas solicitações',
    name: 'Solicitante Teste',
    email: 'requester@helpdesk.test',
    password: 'Requester@123456',
  },
  {
    role: 'AGENT',
    description: 'Recebe, atende e resolve os tickets',
    name: 'Atendente Teste',
    email: 'agent@helpdesk.test',
    password: 'Agent@123456',
  },
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não foi configurada.');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Calculamos os hashes antes da transação para não manter o banco bloqueado.
    const accounts = await Promise.all(
      profiles.map(async (profile) => ({
        ...profile,
        passwordHash: await hash(profile.password, { type: argon2id }),
      })),
    );

    await prisma.$transaction(async (transaction) => {
      for (const account of accounts) {
        const role = await transaction.role.upsert({
          where: { name: account.role },
          create: { name: account.role, description: account.description },
          update: { description: account.description },
        });

        const user = await transaction.user.upsert({
          where: { email: account.email },
          create: {
            name: account.name,
            email: account.email,
            password: account.passwordHash,
            isActive: true,
          },
          // Reexecutar a seed preserva senhas e dados de contas já existentes.
          update: {},
        });

        await transaction.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          create: { userId: user.id, roleId: role.id },
          update: {},
        });
      }
    });

    console.log('Seed concluída: roles e usuários de teste disponíveis.');
    console.table(profiles.map(({ role, email }) => ({ role, email })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Falha ao executar a seed. Verifique DATABASE_URL e as migrations do banco.',
  );
  process.exitCode = 1;
});
