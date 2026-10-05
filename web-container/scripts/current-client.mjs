import { existsSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));

export function normalizeClientId(input) {
  if (typeof input !== 'string') {
    return null;
  }
  const value = input.trim();
  if (!value) {
    return null;
  }
  if (value === 'base' || value === 'default' || value === 'web-extension-default') {
    return 'base';
  }
  if (value.startsWith('client-')) {
    return value;
  }
  if (value.startsWith('web-extension-')) {
    return value.slice('web-extension-'.length);
  }
  return `client-${value}`;
}

export function clientIdFromSymlinkTarget(target) {
  if (typeof target !== 'string' || !target) {
    return null;
  }
  const base = path.basename(target);
  if (base === 'web-extension-default') {
    return 'base';
  }
  const match = /^web-extension-(client-.+)$/.exec(base);
  return match ? match[1] : null;
}

export function readCurrentClient({
  root = defaultRoot,
  symlink = 'current-client',
  readlink = readlinkSync,
  exists = existsSync,
} = {}) {
  const linkPath = path.join(root, symlink);
  if (!exists(linkPath)) {
    throw new Error(
      `[current-client] symlink "${symlink}" tidak ditemukan — jalankan "CLIENT=client-<x> npm run link:client" atau "npm run link:base".`,
    );
  }
  let target = null;
  try {
    target = readlink(linkPath, 'utf8');
  } catch {
    target = null;
  }
  const id = clientIdFromSymlinkTarget(target);
  if (!id) {
    throw new Error(
      `[current-client] symlink "${symlink}" menunjuk "${target}" — bukan folder web-extension-client-<x>/web-extension-default.`,
    );
  }
  return { id, target, path: linkPath };
}

export function resolveClientId({ env = process.env, ...options } = {}) {
  const fromEnv = normalizeClientId(env.VITE_CLIENT);
  if (fromEnv) {
    try {
      const current = readCurrentClient(options);
      if (current.id !== fromEnv) {
        console.warn(
          `[current-client] VITE_CLIENT="${env.VITE_CLIENT}" berbeda dengan symlink (${current.id}); config memakai env, extension yang di-load tetap ${current.id}.`,
        );
      }
    } catch (error) {
      console.warn(`[current-client] ${error.message}`);
    }
    return { id: fromEnv, source: 'env', symlink: null };
  }
  const current = readCurrentClient(options);
  return { id: current.id, source: 'symlink', symlink: current.id };
}
