import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'data/',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // src/core is pure: no DOM, storage or network, and no imports from the UI (docs/ARCHITECTURE.md).
    files: ['src/core/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'navigator'].map(
          name => ({ name, message: 'src/core must stay free of browser APIs.' }),
        ),
      ],
      'no-restricted-imports': ['error', { patterns: ['**/ui/**'] }],
    },
  },
  {
    files: ['scripts/**', '*.config.js', 'tests/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
];
