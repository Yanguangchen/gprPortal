import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'coverage/**',
      'node_modules/**',
      'dist/**',
      '.vercel/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['*.config.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
