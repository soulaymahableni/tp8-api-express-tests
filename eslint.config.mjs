// Configuration ESLint (flat config) pour contact-api (projet ESM : "type": "module")
// Installer : npm i -D eslint @eslint/js globals
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'reports/', 'coverage/', 'dist/', '.npm-cache/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^next$' }],
    },
  },
  {
    // fichiers de tests Vitest (au cas où describe/it/expect sont utilisés sans import)
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
        beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly',
        afterEach: 'readonly', vi: 'readonly',
      },
    },
  },
];
