// Deterministic test configuration; AppModule skips .env when NODE_ENV=test.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/helpdesk_test',
  JWT_SECRET: '4e7c38932fbd08417a2c6905df13b8e97a0c64d218f539b6',
  JWT_ISSUER: 'helpdesk-e2e',
  JWT_AUDIENCE: 'helpdesk-e2e-client',
  CORS_ORIGINS: 'http://localhost:5173',
  AUTH_COOKIE_SAME_SITE: 'lax',
});
