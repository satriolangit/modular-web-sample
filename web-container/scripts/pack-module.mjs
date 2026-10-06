#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const name = process.env.MODULE ?? 'module-runtime-demo';
const distDir = path.join(root, 'dist', 'modules', name);
const pkg = JSON.parse(
  readFileSync(path.join(root, '..', 'runtime-modules', name, 'package.json'), 'utf8'),
);
const containerPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!existsSync(distDir)) {
  console.error(`[pack-module] ${distDir} belum ada — jalankan build:module dulu`);
  process.exit(1);
}

const mfManifestPath = path.join(distDir, 'mf-manifest.json');
if (!existsSync(mfManifestPath)) {
  console.error(`[pack-module] ${mfManifestPath} belum ada — jalankan build:module dulu`);
  process.exit(1);
}

const manifest = {
  name,
  version: pkg.version,
  apiVersion: 1,
  requires: { container: `>=${containerPkg.version}` },
  entry: 'remoteEntry.js',
  css: existsSync(path.join(distDir, 'module.css')) ? ['module.css'] : [],
  builtAgainst: { container: containerPkg.version },
};

const manifestPath = path.join(distDir, 'manifest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const integrity = `sha384-${createHash('sha384').update(readFileSync(mfManifestPath)).digest('base64')}`;
const zipName = `${name}-${pkg.version}.zip`;

const zip = spawnSync('zip', ['-qr', zipName, name], {
  cwd: path.join(root, 'dist', 'modules'),
  stdio: 'inherit',
});
if (zip.status !== 0) {
  process.exit(zip.status ?? 1);
}

console.log(
  JSON.stringify(
    {
      integrity,
      zip: `dist/modules/${zipName}`,
      registryEntry: {
        [name]: {
          version: pkg.version,
          apiVersion: 1,
          manifest: `http://127.0.0.1:4174/${name}/mf-manifest.json`,
          integrity,
          css: [`http://127.0.0.1:4174/${name}/module.css`],
          enabled: true,
        },
      },
    },
    null,
    2,
  ),
);
