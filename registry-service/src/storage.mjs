import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const EMPTY_REGISTRY = { apiVersion: 1, modules: {} };

export function registryPath(dataDir) {
  return path.join(dataDir, 'registry.json');
}

export function modulesRoot(dataDir) {
  return path.join(dataDir, 'modules');
}

export function moduleVersionDir(dataDir, name, version) {
  return path.join(modulesRoot(dataDir), name, version);
}

export function ensureDataDirs(dataDir) {
  mkdirSync(modulesRoot(dataDir), { recursive: true });
  if (!existsSync(registryPath(dataDir))) {
    writeRegistry(dataDir, EMPTY_REGISTRY);
  }
}

export function readRegistry(dataDir) {
  if (!existsSync(registryPath(dataDir))) {
    return { apiVersion: 1, modules: {} };
  }
  return JSON.parse(readFileSync(registryPath(dataDir), 'utf8'));
}

export function writeRegistry(dataDir, registry) {
  const target = registryPath(dataDir);
  const temp = `${target}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(temp, target);
}

export function removeModule(dataDir, name) {
  rmSync(path.join(modulesRoot(dataDir), name), { recursive: true, force: true });
}
