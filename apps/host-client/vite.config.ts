import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      'net-protocol': resolve(__dirname, '../../packages/net-protocol/src'),
      '@ui-kit': resolve(__dirname, '../../packages/ui-kit/src'),
    },
  },
  server: {
    port: 5173,
  },
});
