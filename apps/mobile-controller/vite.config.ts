import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Party Delve Controller',
        short_name: 'PartyDelve',
        theme_color: '#0f0e10',
        background_color: '#0f0e10',
        display: 'fullscreen',
        orientation: 'portrait',
      },
    }),
  ],
  resolve: {
    alias: {
      'shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      'net-protocol': resolve(__dirname, '../../packages/net-protocol/src'),
      '@ui-kit': resolve(__dirname, '../../packages/ui-kit/src'),
    },
  },
  server: {
    port: 5174,
  },
});
