import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { resolveClientId } from './scripts/current-client.mjs';

const require = createRequire(import.meta.url);
const aliases = require('./aliases.cjs') as Record<string, string>;

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));

type Env = Record<string, string | undefined>;

function csvModules(value: string | undefined): string[] {
  return (value ?? 'user-management')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDevConfig(clientId: string, env: Env): Record<string, unknown> {
  const rawJson = env.VITE_CONFIG_JSON?.trim();
  if (rawJson) {
    const compact = rawJson.replace(/[\r\n]+/g, '').trim();
    if (!(compact.startsWith('{') && compact.endsWith('}'))) {
      throw new Error(
        "[dev-config] VITE_CONFIG_JSON must be a JSON object (start with '{' and end with '}')",
      );
    }
    return JSON.parse(compact) as Record<string, unknown>;
  }

  return {
    client: clientId,
    modules: csvModules(env.VITE_MODULES),
    apiBase: env.VITE_API_BASE ?? 'https://dummyjson.com',
    featureFlags: { enableAuditLive: env.VITE_ENABLE_AUDIT_LIVE !== 'false' },
  };
}

function devConfigPlugin(): Plugin {
  return {
    name: 'arsi-dev-config',
    apply: 'serve',
    configureServer(server) {
      const env: Env = { ...loadEnv(server.config.mode, rootDir, ''), ...process.env };
      const fallbackPath = `${server.config.publicDir}/config.json`;

      let clientId: string | null = null;
      try {
        clientId = resolveClientId({ env }).id;
        console.log(`[dev-config] client=${clientId}; /config.json digenerate dari env`);
      } catch (error) {
        console.warn(`[dev-config] ${(error as Error).message}`);
        console.warn(`[dev-config] fallback ke public/config.json`);
      }

      server.middlewares.use('/config.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        try {
          if (env.VITE_CONFIG_JSON?.trim() || clientId) {
            res.end(JSON.stringify(buildDevConfig(clientId ?? 'base', env)));
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

export default defineConfig({
  plugins: [react(), devConfigPlugin()],
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
    sourcemap: true,
  },
});
