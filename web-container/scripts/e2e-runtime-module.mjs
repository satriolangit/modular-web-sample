import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const modulesRoot = path.join(root, 'dist', 'modules');
const name = process.env.MODULE ?? 'module-runtime-demo';
const MODULES_PORT = 4174;
const APP_PORT = 5173;
const APP_URL = `http://localhost:${APP_PORT}`;

const mime = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.map': 'application/json',
};

function startStaticServer(registry) {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      if (req.url === '/registry.json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(registry));
        return;
      }
      const filePath = path.join(modulesRoot, decodeURIComponent(req.url.split('?')[0]));
      const body = await readFile(filePath);
      res.setHeader('Content-Type', mime[path.extname(filePath)] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(MODULES_PORT, '127.0.0.1', () => resolve(server)));
}

async function assertPortFree(url) {
  const inUse = await fetch(url).then(
    () => true,
    () => false,
  );
  if (inUse) {
    throw new Error(`port ${APP_PORT} sudah dipakai (stale dev server?) — matikan dulu`);
  }
}

async function waitForLog(logs, pattern, timeoutMs = 10000, from = 0) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (logs.slice(from).some((line) => pattern.test(line))) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function waitForDevServer(url, timeoutMs = 30000) {
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
  throw new Error(`dev server tidak siap di ${url} setelah ${timeoutMs}ms: ${lastError?.message}`);
}

async function main() {
  const manifestPath = path.join(modulesRoot, name, 'mf-manifest.json');
  const integrity = `sha384-${createHash('sha384')
    .update(await readFile(manifestPath))
    .digest('base64')}`;

  const registry = {
    apiVersion: 1,
    modules: {
      [name]: {
        version: '0.1.0',
        apiVersion: 1,
        manifest: `http://127.0.0.1:${MODULES_PORT}/${name}/mf-manifest.json`,
        integrity,
        css: [`http://127.0.0.1:${MODULES_PORT}/${name}/module.css`],
        enabled: true,
      },
    },
  };

  const staticServer = await startStaticServer(registry);
  let dev;
  let browser;
  try {
    await assertPortFree(APP_URL);

    dev = spawn(process.execPath, ['scripts/dev.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        VITE_REGISTRY_URL: `http://127.0.0.1:${MODULES_PORT}/registry.json`,
        VITE_MODULES: `user-management,product-management,module-sample,${name}`,
      },
      stdio: 'inherit',
      detached: true,
    });

    await waitForDevServer(APP_URL);

    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    const logs = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      const line = `[browser:${message.type()}] ${message.text()}`;
      logs.push(line);
      console.log(line);
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        'container:auth',
        JSON.stringify({
          state: { user: { id: 'e2e', username: 'e2e', displayName: 'e2e' }, isAuthenticated: true },
          version: 0,
        }),
      );
    });

    await page.goto(`${APP_URL}/runtime-demo`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="runtime-demo-client"]', { timeout: 15000 });
    const client = await page.textContent('[data-testid="runtime-demo-client"]');
    if (!client?.includes('client-a')) {
      throw new Error(`client tidak sesuai: ${client}`);
    }

    const styled = await page.$eval('[data-testid="runtime-demo-client"]', (el) =>
      getComputedStyle(el).fontSize,
    );
    if (parseFloat(styled) !== 14) {
      throw new Error(`Tailwind text-sm tidak teraplikasi pada module: fontSize=${styled}`);
    }
    if (errors.length > 0) {
      throw new Error(`page errors: ${errors.join(' | ')}`);
    }
    const initialized = await waitForLog(
      logs,
      new RegExp(`module "${name}" initialized \\(registry `),
    );
    if (!initialized) {
      throw new Error(`log inisialisasi module "${name}" tidak muncul`);
    }
    console.log(`[e2e] runtime module OK (client=${client}, fontSize=${styled})`);

    // Kasus negatif: integritas salah → module ditolak, app tetap boot.
    registry.modules[name].integrity = 'sha384-INVALID';
    const logsBeforeReload = logs.length;
    await page.reload({ waitUntil: 'networkidle' });
    const rejected = await waitForLog(logs, /gagal dimuat dari registry/, 10000, logsBeforeReload);
    if (!rejected) {
      throw new Error('log penolakan "gagal dimuat dari registry" tidak muncul setelah reload');
    }
    const rebooted = await waitForLog(
      logs,
      /extension for client|initialized \(built-in\)/,
      10000,
      logsBeforeReload,
    );
    if (!rebooted) {
      throw new Error('log boot ulang host tidak muncul setelah reload');
    }
    const rendered = await page.locator('[data-testid="runtime-demo-client"]').count();
    if (rendered !== 0) {
      throw new Error(`module tetap ter-render setelah integritas salah (count=${rendered})`);
    }
    if (errors.length > 0) {
      throw new Error(`page errors: ${errors.join(' | ')}`);
    }
    console.log('[e2e] negative integrity case OK (module ditolak, app tetap boot)');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (dev?.pid) {
      try {
        process.kill(-dev.pid, 'SIGTERM');
      } catch {
        dev.kill('SIGTERM');
      }
    }
    await new Promise((resolve) => staticServer.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
