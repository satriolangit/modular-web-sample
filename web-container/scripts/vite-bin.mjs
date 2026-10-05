import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));

const require = createRequire(import.meta.url);
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');

export function runVite(args = []) {
  const child = spawn(process.execPath, [viteBin, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 1));
  return child;
}
