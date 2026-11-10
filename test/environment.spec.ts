const { assertTestDatabaseUrl } = require('./environment.cjs') as {
  assertTestDatabaseUrl(this: void, value: string): void;
};

describe('Test database isolation', () => {
  const local =
    'postgresql://helpdesk_test:fixture@localhost:5432/helpdesk_test';

  it.each([local, `${local}?schema=public`])(
    'accepts the dedicated local database: %s',
    (url) => {
      expect(() => assertTestDatabaseUrl(url)).not.toThrow();
    },
  );

  it.each([
    local.replace(/helpdesk_test$/, 'helpdesk-db'),
    local.replace('helpdesk_test:fixture', 'postgres:fixture'),
    local.replace('localhost', 'remote.test'),
    `${local}?host=remote.test`,
    `${local}?user=postgres`,
    `${local}?dbname=helpdesk-db`,
    `${local}?schema=public&host=remote.test`,
    `${local}?schema=public&schema=other`,
    `${local}?schema=other`,
  ])('rejects connections outside the dedicated test target: %s', (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow();
  });
});
