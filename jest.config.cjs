const path = require('node:path');
const { pathsToModuleNameMapper } = require('ts-jest');
const ts = require('typescript');

const { config: tsconfig } = ts.readConfigFile(
  path.resolve(__dirname, 'tsconfig.json'),
  (filename) => ts.sys.readFile(filename),
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

/** @type {import('jest').Config} */
const config = {
  rootDir: __dirname,
  // A IDE descobre testes unitários e e2e pela mesma configuração.
  projects: [
    {
      displayName: 'unit',
      rootDir: __dirname,
      moduleFileExtensions: ['js', 'json', 'ts'],
      testRegex: '.*\\.spec\\.ts$',
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
        '^.+\\.m?js$': [
          '@swc/jest',
          {
            jsc: { target: 'es2022' },
            module: { type: 'commonjs' },
          },
        ],
      },
      // Nest 12 é ESM. O SWC converte seus módulos JS, inclusive import.meta,
      // para o Jest CommonJS, sem depender de flags do Node na IDE.
      transformIgnorePatterns: ['node_modules/(?!(?:\\.pnpm/|@nestjs/))'],
      moduleNameMapper: pathsToModuleNameMapper(paths, {
        prefix: '<rootDir>/',
      }),
    },
    '<rootDir>/test/jest-e2e.json',
  ],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  maxWorkers: 2,
};

module.exports = config;
