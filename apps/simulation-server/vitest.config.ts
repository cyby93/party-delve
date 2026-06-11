import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000, // 10s per test — WS e2e tests need room to breathe
  },
});
