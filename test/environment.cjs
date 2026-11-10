const { readFileSync } = require('node:fs');
const path = require('node:path');
const { parse } = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const environmentPath = path.join(rootDir, '.env.test');

function assertTestDatabaseUrl(value) {
  const url = new URL(value);
  const parameters = [...url.searchParams.entries()];
  // O pg aceita host/user pela query string; permitimos somente o schema público.
  const safeParameters =
    parameters.length === 0 ||
    (parameters.length === 1 &&
      parameters[0][0] === 'schema' &&
      parameters[0][1] === 'public');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/helpdesk_test' ||
    decodeURIComponent(url.username) !== 'helpdesk_test' ||
    url.hash ||
    !safeParameters
  ) {
    throw new Error(
      'DATABASE_URL de teste deve usar helpdesk_test no PostgreSQL local, com o usuário helpdesk_test e somente schema=public como parâmetro opcional.',
    );
  }
}

function loadTestEnvironment() {
  let values;
  try {
    values = parse(readFileSync(environmentPath));
  } catch {
    throw new Error('Configure o banco de teste com pnpm db:test:setup.');
  }
  // A preparação automática só pode atuar no banco local dedicado aos testes.
  assertTestDatabaseUrl(values.DATABASE_URL);
  const environment = { NODE_ENV: 'test' };
  for (const key of [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'CORS_ORIGINS',
    'AUTH_COOKIE_SAME_SITE',
    'TEST_POSTGRES_CONTAINER',
  ]) {
    if (values[key] !== undefined) environment[key] = values[key];
  }
  return environment;
}

module.exports = {
  rootDir,
  environmentPath,
  loadTestEnvironment,
  assertTestDatabaseUrl,
};
