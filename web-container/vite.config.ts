import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const aliases = require('./aliases.cjs') as Record<string, string>;

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: aliases,
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'zustand',
      '@tanstack/react-query',
      'i18next',
      'react-i18next',
      'axios',
      'sonner',
    ],
  },
  server: {
    port: 5173,
    fs: {
      allow: [workspaceRoot],
    },
  },
  build: {
    sourcemap: true,
  },
});
