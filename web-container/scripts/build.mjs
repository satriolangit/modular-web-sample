#!/usr/bin/env node
import path from 'node:path';

import { resolveClientId } from './current-client.mjs';
import { root, runVite } from './vite-bin.mjs';

try {
  process.loadEnvFile?.(path.join(root, '.env'));
} catch {
  // .env is optional
}

const client = resolveClientId({});
const outDir = path.join('dist', client.id);

console.log(`[build] client=${client.id} (sumber: ${client.source}) → ${outDir}`);

runVite(['build', '--outDir', outDir]);
