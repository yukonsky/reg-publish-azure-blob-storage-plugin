import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptEslintParser from '@typescript-eslint/parser';
import globals from 'globals';

/**
 * @type {import('eslint').Linter.Config[]}
 */
export default [
  {
    ignores: ['**/node_modules/**', '.pnpm-store'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      parser: typescriptEslintParser,
    },
  },
  {
    rules: {
      eqeqeq: 2,
      'no-console': 'error',
    },
  },
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/ban-types': [
        'off',
        {
          types: {
            '{}': false,
          },
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        NodeJS: 'readonly',
      },
    },
  },
];
