import express from 'express';
import { bearerAuth } from './auth.mjs';
import { loadConfig } from './config.mjs';
import { ensureDataDirs, modulesRoot, readRegistry } from './storage.mjs';

export function createApp(config) {
  ensureDataDirs(config.dataDir);
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/registry.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.json(readRegistry(config.dataDir));
  });

  app.use(
    '/modules',
    express.static(modulesRoot(config.dataDir), {
      immutable: true,
      maxAge: '1y',
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
      },
    }),
  );

  app.get('/api/modules', bearerAuth(config), (_req, res) => {
    const registry = readRegistry(config.dataDir);
    res.json({ modules: Object.entries(registry.modules).map(([name, module]) => ({ name, ...module })) });
  });

  return app;
}

export function startServer(config) {
  const app = createApp(config);
  return app.listen(config.port, () => {
    console.log(`[registry-service] listening on ${config.port} (data: ${config.dataDir})`);
  });
}

import { fileURLToPath } from 'node:url';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer(loadConfig());
}
