import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// O runner E2E carrega .env.test antes de chamar o CLI. Nunca completamos esse
// ambiente com o .env de desenvolvimento; fora dos testes, o fluxo atual continua igual.
config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

// O schema descreve as tabelas; migrations criam essas tabelas; seed preenche os dados iniciais.
// São etapas diferentes: criar a estrutura não cria automaticamente roles ou um ADMIN.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // pnpm db:seed prepara as três roles e suas contas de teste.
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
