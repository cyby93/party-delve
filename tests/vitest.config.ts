import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['unit/**/*.test.ts', 'e2e/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      'shared-types': new URL('../packages/shared-types/src/index.ts', import.meta.url).pathname,
    },
  },
});
