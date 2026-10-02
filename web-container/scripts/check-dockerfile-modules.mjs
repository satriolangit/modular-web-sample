#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dockerfilePath = fileURLToPath(new URL('../../Dockerfile', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

function modulePackageJsons() {
  const modulesDir = `${workspaceRoot}/web-modules/modules`;
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(`${modulesDir}/${name}/package.json`))
    .map((name) => `web-modules/modules/${name}/package.json`);
}

const required = [
  'web-modules/package.json',
  'web-modules/shared/package.json',
  ...modulePackageJsons(),
  'web-extension-base/package.json',
];

const dockerfile = readFileSync(dockerfilePath, 'utf8');
const missing = required.filter((path) => !dockerfile.includes(`COPY ${path} `));

if (missing.length > 0) {
  console.error('[check:dockerfile] package.json berikut belum di-COPY di Dockerfile:');
  for (const path of missing) {
    console.error(`  - ${path}`);
  }
  console.error('Tambahkan baris COPY sebelum `npm ci` agar dependency ter-install saat build.');
  process.exit(1);
}

console.log(`[check:dockerfile] OK — ${required.length} package.json ter-COPY sebelum npm ci.`);
