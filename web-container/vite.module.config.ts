import { fileURLToPath } from 'node:url';

import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const name = process.env.MODULE ?? 'module-runtime-demo';

const shared = {
  react: { singleton: true },
  'react-dom': { singleton: true },
  'react/jsx-runtime': { singleton: true },
  'react/jsx-dev-runtime': { singleton: true },
  'react-router': { singleton: true },
  'react-router-dom': { singleton: true },
  zustand: { singleton: true },
  '@tanstack/react-query': { singleton: true },
  i18next: { singleton: true },
  'react-i18next': { singleton: true },
  axios: { singleton: true },
  sonner: { singleton: true },
};

export default defineConfig({
  publicDir: false,
  plugins: [
    react(),
    federation({
      name,
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: { './entry': `../runtime-modules/${name}/index.tsx` },
      shared,
    }),
  ],
  build: {
    target: 'esnext',
    outDir: `dist/modules/${name}`,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL(`../runtime-modules/${name}/index.tsx`, import.meta.url)),
    },
  },
});
