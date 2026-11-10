const { randomBytes } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');
const { parse } = require('dotenv');
const {
  rootDir,
  environmentPath,
  loadTestEnvironment,
} = require('../test/environment.cjs');

function createEnvironment() {
  if (existsSync(environmentPath)) return;
  const development = parse(readFileSync(path.join(rootDir, '.env')));
  const url = new URL(development.DATABASE_URL);
  url.pathname = '/helpdesk_test';
  url.username = 'helpdesk_test';
  url.password = randomBytes(24).toString('hex');
  url.search = '?schema=public';
  const values = {
    NODE_ENV: 'test',
    DATABASE_URL: url.toString(),
    JWT_SECRET: randomBytes(48).toString('hex'),
    JWT_ISSUER: 'helpdesk-test',
    JWT_AUDIENCE: 'helpdesk-test-client',
    CORS_ORIGINS: 'http://localhost:5173',
    AUTH_COOKIE_SAME_SITE: 'lax',
    TEST_POSTGRES_CONTAINER: 'postgres-helpdesk',
  };
  writeFileSync(
    environmentPath,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600, flag: 'wx' },
  );
}

async function connect(url) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end();
    throw error;
  }
}

async function provision(environment) {
  const development = parse(readFileSync(path.join(rootDir, '.env')));
  const adminUrl = new URL(development.DATABASE_URL);
  const testUrl = new URL(environment.DATABASE_URL);
  if (
    adminUrl.host !== testUrl.host ||
    adminUrl.pathname === testUrl.pathname
  ) {
    throw new Error(
      'A conexão administrativa deve usar o mesmo servidor e um banco diferente do banco de teste.',
    );
  }
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = await connect(adminUrl.toString());
  try {
    const role = await admin.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      ['helpdesk_test'],
    );
    if (!role.rowCount) {
      const password = decodeURIComponent(testUrl.password).replaceAll(
        "'",
        "''",
      );
      await admin.query(
        `CREATE ROLE helpdesk_test LOGIN PASSWORD '${password}'`,
      );
    }
    const database = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      ['helpdesk_test'],
    );
    if (!database.rowCount) {
      await admin.query('CREATE DATABASE helpdesk_test OWNER helpdesk_test');
    }
  } finally {
    await admin.end();
  }
}

function runPrisma(args, environment) {
  try {
    const prismaPackage = require.resolve('prisma/package.json');
    const prismaCli = path.join(
      path.dirname(prismaPackage),
      require(prismaPackage).bin.prisma,
    );
    execFileSync(
      process.execPath,
      [prismaCli, ...args, '--config', path.join(rootDir, 'prisma7.config.ts')],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          ...environment,
          // A IDE inicia o Jest sem os executáveis locais que o pnpm adiciona.
          PATH: [
            path.dirname(process.execPath),
            path.join(rootDir, 'node_modules', '.bin'),
            process.env.PATH,
          ]
            .filter(Boolean)
            .join(path.delimiter),
        },
        stdio: 'pipe',
        timeout: 60_000,
      },
    );
  } catch (error) {
    // Erros do driver/CLI podem conter credenciais; devolvemos só o código da etapa.
    throw new Error(
      `Falha no Prisma (${args.join(' ')}). Confira o PostgreSQL e a configuração em .env.test.`,
      { cause: { status: error.status } },
    );
  }
}

async function prepareTestDatabase({ seed = false } = {}) {
  createEnvironment();
  const environment = loadTestEnvironment();
  let client;
  try {
    client = await connect(environment.DATABASE_URL);
  } catch (error) {
    if (error.code === 'ECONNREFUSED' && environment.TEST_POSTGRES_CONTAINER) {
      try {
        execFileSync('docker', ['start', environment.TEST_POSTGRES_CONTAINER], {
          stdio: 'pipe',
          timeout: 15_000,
        });
      } catch {
        throw new Error(
          'Inicie o Docker Desktop para disponibilizar o PostgreSQL dos testes.',
        );
      }
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        try {
          client = await connect(environment.DATABASE_URL);
          break;
        } catch (retryError) {
          if (retryError.code !== 'ECONNREFUSED') break;
        }
      }
    }
    if (!client) {
      await provision(environment);
      client = await connect(environment.DATABASE_URL);
    }
  }
  await client.end();
  runPrisma(['migrate', 'deploy'], environment);
  if (seed) runPrisma(['db', 'seed'], environment);
  console.log(
    seed
      ? 'Banco helpdesk_test pronto; migrations e seed aplicadas.'
      : 'Banco helpdesk_test pronto; migrations aplicadas.',
  );
}

module.exports = { prepareTestDatabase };

if (require.main === module) {
  prepareTestDatabase({ seed: true }).catch((error) => {
    console.error(
      error.message && !error.code
        ? error.message
        : `Falha ao preparar o banco de teste (${error.code ?? 'conexão'}).`,
    );
    process.exitCode = 1;
  });
}
