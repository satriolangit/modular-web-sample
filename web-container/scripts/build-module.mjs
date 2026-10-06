#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const name = process.env.MODULE ?? 'module-runtime-demo';

function run(bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), [
  'build',
  '--config',
  'vite.module.config.ts',
]);

run(path.join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js'), [
  '-c',
  'tailwind.module.cjs',
  '-i',
  `../runtime-modules/${name}/styles.css`,
  '-o',
  `dist/modules/${name}/module.css`,
  '--minify',
]);

console.log(`[build-module] ${name} → dist/modules/${name}`);
