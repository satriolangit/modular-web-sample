import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { readCurrentClient } from './current-client.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const workspace = path.join(root, '..');
const ADMIN_TOKEN = 'e2e-admin-token';
const SERVICE_PORT = 4310;
const APP_PORT = 5173;
const APP_URL = `http://localhost:${APP_PORT}`;
const SERVICE_URL = `http://127.0.0.1:${SERVICE_PORT}`;
const MODULE_NAME = 'module-runtime-demo';
const EXPECTED_CLIENT = 'client-a';
const ZIP_PATH = path.join(root, 'dist', 'modules', `${MODULE_NAME}-0.1.0.zip`);

async function waitFor(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`[e2e] timeout menunggu ${url}: ${lastError?.message}`);
}

async function assertPortFree(url) {
  const inUse = await fetch(url).then(
    () => true,
    () => false,
  );
  if (inUse) {
    throw new Error(`[e2e] ${url} sudah merespons — matikan server lama sebelum menjalankan e2e`);
  }
}

function assertCurrentClient() {
  const { id, target } = readCurrentClient({ root });
  if (id !== EXPECTED_CLIENT) {
    throw new Error(
      `[e2e] current-client menunjuk "${target}" (${id}) — jalankan "CLIENT=client-a npm run link:client" di web-container`,
    );
  }
}

async function readRegistry() {
  const response = await fetch(`${SERVICE_URL}/registry.json`);
  if (!response.ok) {
    throw new Error(`registry.json HTTP ${response.status}`);
  }
  return response.json();
}

async function waitForRegistry(predicate, description, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await readRegistry();
      if (predicate(last)) return last;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    `[e2e] timeout menunggu ${description}; registry terakhir: ${JSON.stringify(last)}`,
  );
}

function killGroup(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // process sudah berhenti
    }
  }
}

async function main() {
  if (!existsSync(ZIP_PATH)) {
    throw new Error(
      `[e2e] zip tidak ditemukan: ${ZIP_PATH} — jalankan "MODULE=${MODULE_NAME} npm run build:module && MODULE=${MODULE_NAME} npm run pack:module --silent" di web-container`,
    );
  }
  assertCurrentClient();
  await assertPortFree(`${APP_URL}/`);
  await assertPortFree(`${SERVICE_URL}/healthz`);

  const dataDir = mkdtempSync(path.join(tmpdir(), 'registry-e2e-'));
  const service = spawn(process.execPath, ['src/server.mjs'], {
    cwd: path.join(workspace, 'registry-service'),
    env: {
      ...process.env,
      ADMIN_TOKEN,
      DATA_DIR: dataDir,
      PORT: String(SERVICE_PORT),
      PUBLIC_BASE_URL: `http://127.0.0.1:${SERVICE_PORT}`,
    },
    stdio: 'inherit',
    detached: true,
  });

  const dev = spawn(process.execPath, ['scripts/dev.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      VITE_REGISTRY_URL: `http://127.0.0.1:${SERVICE_PORT}/registry.json`,
      VITE_REGISTRY_ADMIN_URL: `http://127.0.0.1:${SERVICE_PORT}`,
      VITE_MODULES: 'user-management,module-sample,registry-admin',
    },
    stdio: 'inherit',
    detached: true,
  });

  let browser;
  try {
    await waitFor(`${SERVICE_URL}/healthz`);
    await waitFor(`${APP_URL}/`);

    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
    page.on('requestfailed', (request) =>
      console.log(
        `[browser:requestfailed] ${request.method()} ${request.url()} — ${request.failure()?.errorText}`,
      ),
    );
    await page.addInitScript((token) => {
      localStorage.setItem(
        'container:auth',
        JSON.stringify({
          state: { user: { id: 'e2e', username: 'e2e', displayName: 'e2e' }, isAuthenticated: true },
          version: 0,
        }),
      );
      localStorage.setItem('registry-admin:token', token);
    }, ADMIN_TOKEN);

    await page.goto(`${APP_URL}/system/modules`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Module Registry', { timeout: 15000 });

    // upload zip hasil pack
    await page.setInputFiles('input[type="file"]', ZIP_PATH);
    const row = page.locator('tbody tr', { hasText: MODULE_NAME });
    await row.waitFor({ timeout: 15000 });

    // disable
    await row.getByRole('button', { name: /disable/i }).click();
    await waitForRegistry(
      (registry) => registry.modules[MODULE_NAME]?.enabled === false,
      'disable tersimpan',
    );
    await row.getByRole('button', { name: /enable/i }).waitFor({ timeout: 15000 });

    // delete
    await row.getByRole('button', { name: /delete/i }).click();
    await waitForRegistry((registry) => !registry.modules[MODULE_NAME], 'delete menghapus module');
    await row.waitFor({ state: 'detached', timeout: 15000 });

    if (errors.length > 0) {
      throw new Error(`[e2e] page errors: ${errors.join(' | ')}`);
    }
    console.log('[e2e] registry-admin OK (upload → disable → delete)');
  } finally {
    if (browser) await browser.close().catch(() => {});
    killGroup(dev);
    killGroup(service);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
