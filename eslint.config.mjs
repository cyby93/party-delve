import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    files: ['apps/host-client/**/*.{ts,tsx}', 'apps/mobile-controller/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/game-rules**', 'game-rules', '@game-rules/**'],
              message: 'game-rules must not be imported in client apps — authority violation',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/game-rules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/net-protocol**', 'net-protocol', '@net-protocol/**'],
              message: 'net-protocol must not be imported in game-rules — no I/O in pure functions',
            },
            {
              group: ['**/ui-kit**', 'ui-kit', '@ui-kit/**'],
              message: 'ui-kit must not be imported in game-rules — no UI in pure functions',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/simulation-server/**/*.ts', 'packages/game-rules/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="Math"][property.name="random"]',
          message: 'Use xoshiro128++ PRNG from game-rules instead of Math.random()',
        },
      ],
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
];
