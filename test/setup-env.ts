import { validateEnvironment } from '../src/config/environment';

const { loadTestEnvironment } = require('./environment.cjs') as {
  loadTestEnvironment(this: void): Record<string, string>;
};

// Sobrescreve valores herdados da IDE; os testes nunca completam dados com .env.
Object.assign(process.env, validateEnvironment(loadTestEnvironment()));
