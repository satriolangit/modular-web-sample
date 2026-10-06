import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/server.mjs';

const TOKEN = 'test-token';

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
  return { server, base: `http://127.0.0.1:${port}` };
}

let running = [];
afterEach(() => {
  for (const server of running) server.close();
  running = [];
});

describe('registry service', () => {
  it('gagal start tanpa ADMIN_TOKEN', () => {
    expect(() => loadConfig({})).toThrow(/ADMIN_TOKEN/);
  });

  it('healthz publik', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('registry.json kosong + no-store', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await fetch(`${base}/registry.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await res.json()).toEqual({ apiVersion: 1, modules: {} });
  });

  it('API modules butuh bearer token', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await fetch(`${base}/api/modules`);
    expect(res.status).toBe(401);
  });

  it('preflight CORS /api diizinkan untuk admin API', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await fetch(`${base}/api/modules`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(res.headers.get('access-control-allow-headers').toLowerCase()).toContain(
      'authorization',
    );
  });

  it('respons /api menyertakan Access-Control-Allow-Origin', async () => {
    const { server, base } = await startApp(testConfig());
    running.push(server);
    const res = await fetch(`${base}/api/modules`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('CORS_ORIGIN dipakai di /api dan preflight', async () => {
    const { server, base } = await startApp(testConfig({ CORS_ORIGIN: 'http://localhost:5173' }));
    running.push(server);
    const res = await fetch(`${base}/api/modules`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
