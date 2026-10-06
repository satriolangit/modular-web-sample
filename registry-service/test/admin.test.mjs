import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/server.mjs';

const TOKEN = 'test-token';
let running = [];

function buildZip(name = 'demo-module') {
  const manifest = {
    name,
    version: '1.0.0',
    apiVersion: 1,
    requires: { container: '>=0.1.0' },
    entry: 'remoteEntry.js',
    css: ['module.css'],
    builtAgainst: { container: '0.1.0' },
  };
  return Buffer.from(
    zipSync({
      'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)),
      'mf-manifest.json': new TextEncoder().encode(JSON.stringify({ name, metaData: {} })),
      'remoteEntry.js': new TextEncoder().encode('export default 1;'),
      'module.css': new TextEncoder().encode('.x{}'),
      'assets/index-a.js': new TextEncoder().encode('export default 1;'),
    }),
  );
}

async function setup() {
  const config = loadConfig({ ADMIN_TOKEN: TOKEN, DATA_DIR: mkdtempSync(path.join(tmpdir(), 'registry-')) });
  const server = createApp(config).listen(0);
  running.push(server);
  const base = `http://127.0.0.1:${server.address().port}`;
  const form = new FormData();
  form.append('file', new Blob([buildZip()]), 'demo-module-1.0.0.zip');
  const upload = await fetch(`${base}/api/modules`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  expect(upload.status).toBe(201);
  return { base, config };
}

afterEach(() => {
  for (const server of running) server.close();
  running = [];
});

describe('admin endpoints', () => {
  it('list memuat metadata module', async () => {
    const { base } = await setup();
    const res = await fetch(`${base}/api/modules`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const body = await res.json();
    expect(body.modules).toHaveLength(1);
    expect(body.modules[0]).toMatchObject({ name: 'demo-module', version: '1.0.0', enabled: true });
  });

  it('disable + enable tersimpan di registry', async () => {
    const { base, config } = await setup();
    const patch = (enabled) =>
      fetch(`${base}/api/modules/demo-module`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

    expect((await patch(false)).status).toBe(200);
    let registry = JSON.parse(readFileSync(path.join(config.dataDir, 'registry.json'), 'utf8'));
    expect(registry.modules['demo-module'].enabled).toBe(false);

    expect((await patch(true)).status).toBe(200);
    registry = JSON.parse(readFileSync(path.join(config.dataDir, 'registry.json'), 'utf8'));
    expect(registry.modules['demo-module'].enabled).toBe(true);
  });

  it('PATCH menolak enabled non-boolean dan registry tidak berubah', async () => {
    const { base, config } = await setup();
    const res = await fetch(`${base}/api/modules/demo-module`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: 'yes' }),
    });
    expect(res.status).toBe(400);
    const registry = JSON.parse(readFileSync(path.join(config.dataDir, 'registry.json'), 'utf8'));
    expect(registry.modules['demo-module'].enabled).toBe(true);
  });

  it('PATCH/DELETE 404 untuk nama tak dikenal', async () => {
    const { base } = await setup();
    const patch = await fetch(`${base}/api/modules/nope`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(patch.status).toBe(404);
    const del = await fetch(`${base}/api/modules/nope`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(del.status).toBe(404);
  });

  it('delete menghapus entry + file', async () => {
    const { base, config } = await setup();
    const res = await fetch(`${base}/api/modules/demo-module`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(204);
    const registry = JSON.parse(readFileSync(path.join(config.dataDir, 'registry.json'), 'utf8'));
    expect(registry.modules['demo-module']).toBeUndefined();
    const staticRes = await fetch(`${base}/modules/demo-module/1.0.0/mf-manifest.json`);
    expect(staticRes.status).toBe(404);
  });
});
