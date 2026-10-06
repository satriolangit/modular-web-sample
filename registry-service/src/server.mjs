import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { writeAudit } from './audit.mjs';
import { bearerAuth } from './auth.mjs';
import { loadConfig } from './config.mjs';
import { verifyEd25519 } from './signature.mjs';
import { ensureDataDirs, moduleVersionDir, modulesRoot, readRegistry, removeModule, writeRegistry } from './storage.mjs';
import { computeIntegrity, extractTo, parseManifest, unzip, ValidationError } from './validate.mjs';

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

  app.use('/api', (req, res, next) => {
    res.setHeader('Vary', 'Origin');
    if (config.adminCorsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', config.adminCorsOrigin);
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json());

  app.get('/api/modules', bearerAuth(config), (_req, res) => {
    const registry = readRegistry(config.dataDir);
    res.json({ modules: Object.entries(registry.modules).map(([name, module]) => ({ name, ...module })) });
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes },
  });

  app.post('/api/modules', bearerAuth(config), upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        throw new ValidationError('file zip wajib diisi (field "file")');
      }
      if (!req.file.originalname.endsWith('.zip')) {
        throw new ValidationError('file harus berekstensi .zip');
      }
      const zipFiles = unzip(req.file.buffer);
      const { manifest, css } = parseManifest(zipFiles);
      const mfBytes = zipFiles['mf-manifest.json'];
      const integrity = computeIntegrity(mfBytes);

      if (config.signingPublicKey) {
        const signature = zipFiles['signature.ed25519'];
        if (!signature) {
          throw new ValidationError('signature.ed25519 wajib saat SIGNING_PUBLIC_KEY aktif');
        }
        if (!verifyEd25519(mfBytes, signature, config.signingPublicKey)) {
          throw new ValidationError('signature ed25519 tidak valid');
        }
      }

      const registry = readRegistry(config.dataDir);
      if (registry.modules[manifest.name]?.version === manifest.version) {
        res.status(409).json({ error: `module ${manifest.name}@${manifest.version} sudah ada` });
        return;
      }

      const targetDir = moduleVersionDir(config.dataDir, manifest.name, manifest.version);
      rmSync(targetDir, { recursive: true, force: true });
      mkdirSync(path.dirname(targetDir), { recursive: true });
      extractTo(targetDir, zipFiles);

      const base = `${config.publicBaseUrl}/modules/${manifest.name}/${manifest.version}`;
      registry.modules[manifest.name] = {
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        manifest: `${base}/mf-manifest.json`,
        integrity,
        css: css.map((file) => `${base}/${file}`),
        enabled: true,
      };
      writeAudit(config.dataDir, {
        actor: config.adminActor,
        action: 'upload',
        name: manifest.name,
        version: manifest.version,
        ip: req.ip,
      });
      writeRegistry(config.dataDir, registry);
      res.status(201).json({ module: { name: manifest.name, ...registry.modules[manifest.name] } });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error('[registry-service] upload error', error);
      res.status(500).json({ error: 'internal error' });
    }
  });

  app.patch('/api/modules/:name', bearerAuth(config), (req, res) => {
    const { name } = req.params;
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'body.enabled harus boolean' });
      return;
    }
    const registry = readRegistry(config.dataDir);
    const module = registry.modules[name];
    if (!module) {
      res.status(404).json({ error: `module "${name}" tidak ditemukan` });
      return;
    }
    module.enabled = enabled;
    writeAudit(config.dataDir, {
      actor: config.adminActor,
      action: enabled ? 'enable' : 'disable',
      name,
      version: module.version,
      ip: req.ip,
    });
    writeRegistry(config.dataDir, registry);
    res.json({ module: { name, ...module } });
  });

  app.delete('/api/modules/:name', bearerAuth(config), (req, res) => {
    const { name } = req.params;
    const registry = readRegistry(config.dataDir);
    const module = registry.modules[name];
    if (!module) {
      res.status(404).json({ error: `module "${name}" tidak ditemukan` });
      return;
    }
    delete registry.modules[name];
    writeAudit(config.dataDir, {
      actor: config.adminActor,
      action: 'delete',
      name,
      version: module.version,
      ip: req.ip,
    });
    writeRegistry(config.dataDir, registry);
    removeModule(config.dataDir, name);
    res.status(204).end();
  });

  app.use((error, _req, res, _next) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'file melebihi batas ukuran' });
      return;
    }
    console.error('[registry-service] error', error);
    res.status(500).json({ error: 'internal error' });
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
