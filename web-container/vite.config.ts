import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { resolveClientId } from './scripts/current-client.mjs';
import { buildDevConfig, loadBaseConfig } from './scripts/dev-config.mjs';

const require = createRequire(import.meta.url);
const aliases = require('./aliases.cjs') as Record<string, string>;

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));

type Env = Record<string, string | undefined>;

function devConfigPlugin(): Plugin {
  return {
    name: 'arsi-dev-config',
    apply: 'serve',
    configureServer(server) {
      const env: Env = { ...loadEnv(server.config.mode, rootDir, ''), ...process.env };
      const fallbackPath = `${server.config.publicDir}/config.json`;
      const base = loadBaseConfig(server.config.publicDir);

      let clientId: string | null = null;
      try {
        clientId = resolveClientId({ env }).id;
        console.log(
          `[dev-config] client=${clientId}; /config.json = env + public/config.json${base ? '' : ' (base tidak ada)'}`,
        );
      } catch (error) {
        console.warn(`[dev-config] ${(error as Error).message}`);
        console.warn(`[dev-config] fallback ke public/config.json`);
      }

      server.middlewares.use('/config.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        try {
          if (env.VITE_CONFIG_JSON?.trim() || clientId) {
            res.end(JSON.stringify(buildDevConfig({ clientId: clientId ?? 'base', env, base })));
            return;
          }
          if (existsSync(fallbackPath)) {
            res.end(readFileSync(fallbackPath, 'utf8'));
            return;
          }
          throw new Error(
            '[dev-config] tidak ada client (symlink/.env) dan public/config.json tidak ditemukan',
          );
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      });
    },
  };
}

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
  plugins: [
    react(),
    federation({
      name: 'arsi-host',
      shared,
    }),
    devConfigPlugin(),
  ],
  resolve: {
    alias: aliases,
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router',
      'react-router-dom',
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
    target: 'esnext',
    sourcemap: true,
  },
});
