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
process.env.VITE_CLIENT ??= client.id;

console.log(
  `[dev] client=${client.id} (sumber: ${client.source}); config.json digenerate dari env`,
);

runVite([]);
