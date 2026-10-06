import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/server.mjs';

const TOKEN = 'test-token';
let running = [];

function testConfig(overrides = {}) {
  return loadConfig({
    ADMIN_TOKEN: TOKEN,
    DATA_DIR: mkdtempSync(path.join(tmpdir(), 'registry-')),
    ...overrides,
  });
}

async function startApp(config) {
  const app = createApp(config);
  const server = app.listen(0);
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}`, config };
}

afterEach(() => {
  for (const server of running) server.close();
  running = [];
});

function buildZip({ name = 'demo-module', version = '1.0.0', apiVersion = 1, extra = {}, drop = [] } = {}) {
  const manifest = {
    name,
    version,
    apiVersion,
    requires: { container: '>=0.1.0' },
    entry: 'remoteEntry.js',
    css: ['module.css'],
    builtAgainst: { container: '0.1.0' },
  };
  const files = {
    'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)),
    'mf-manifest.json': new TextEncoder().encode(JSON.stringify({ name, metaData: {} })),
    'remoteEntry.js': new TextEncoder().encode('export const x = 1;'),
    'module.css': new TextEncoder().encode('.x{color:red}'),
    'assets/index-abc.js': new TextEncoder().encode('export default 1;'),
    ...extra,
  };
  for (const file of drop) delete files[file];
  return Buffer.from(zipSync(files));
}

async function upload(base, zip, { token = TOKEN, filename = 'demo-module-1.0.0.zip' } = {}) {
  const form = new FormData();
  form.append('file', new Blob([zip]), filename);
  return fetch(`${base}/api/modules`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
}

describe('POST /api/modules', () => {
  it('menolak tanpa token', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await upload(base, buildZip(), { token: null });
    expect(res.status).toBe(401);
  });

  it('upload valid → 201 + registry + integrity + audit', async () => {
    const { server, base, config } = await startApp(testConfig());
    running.push(server);
    const res = await upload(base, buildZip());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.module.version).toBe('1.0.0');
    expect(body.module.enabled).toBe(true);
    expect(body.module.integrity).toMatch(/^sha384-/);
    expect(body.module.manifest).toBe(`${config.publicBaseUrl}/modules/demo-module/1.0.0/mf-manifest.json`);
    expect(body.module.css).toEqual([`${config.publicBaseUrl}/modules/demo-module/1.0.0/module.css`]);

    const registry = JSON.parse(readFileSync(path.join(config.dataDir, 'registry.json'), 'utf8'));
    expect(registry.modules['demo-module'].integrity).toBe(body.module.integrity);
    const audit = readFileSync(path.join(config.dataDir, 'audit.jsonl'), 'utf8').trim().split('\n');
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0])).toMatchObject({ action: 'upload', name: 'demo-module', version: '1.0.0' });
  });

  it('menolak zip-slip', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await upload(base, buildZip({ extra: { '../evil.js': new TextEncoder().encode('x') } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/path/);
  });

  it('menolak manifest tidak valid', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    expect((await upload(base, buildZip({ apiVersion: 2 }))).status).toBe(400);
    expect((await upload(base, buildZip({ name: 'Demo_Module' }))).status).toBe(400);
    expect((await upload(base, buildZip({ drop: ['remoteEntry.js'] }))).status).toBe(400);
    expect((await upload(base, buildZip({ drop: ['module.css'] }))).status).toBe(400);
  });

  it('menolak duplikat name+version (409)', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    expect((await upload(base, buildZip())).status).toBe(201);
    expect((await upload(base, buildZip())).status).toBe(409);
  });

  it('menolak file melebihi batas (413)', async () => {
    const config = testConfig({ MAX_UPLOAD_BYTES: '128' });
    const { server, base } = await startApp(config);
    running.push(server);
    const res = await upload(base, buildZip());
    expect(res.status).toBe(413);
  });

  it('verifikasi signature bila SIGNING_PUBLIC_KEY di-set', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const config = testConfig({ SIGNING_PUBLIC_KEY: pem });
    const { server, base } = await startApp(config);
    running.push(server);

    const mfBytes = new TextEncoder().encode(JSON.stringify({ name: 'demo-module', metaData: {} }));
    const signature = sign(null, Buffer.from(mfBytes), privateKey);

    const unsigned = await upload(base, buildZip());
    expect(unsigned.status).toBe(400);

    const signed = await upload(
      base,
      buildZip({ extra: { 'signature.ed25519': new Uint8Array(signature) } }),
    );
    expect(signed.status).toBe(201);
  });
});
