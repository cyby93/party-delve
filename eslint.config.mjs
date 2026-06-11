import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'eslint.config.mjs',
      '.claude/**',
      '_bmad/**',
      '_bmad-output/**',
    ],
  },

  // TypeScript files (all packages)
  {
    files: ['apps/*/src/**/*.ts', 'packages/*/src/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // TSX files (React apps)
  {
    files: ['apps/host-client/src/**/*.tsx', 'apps/mobile-controller/src/**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
);
