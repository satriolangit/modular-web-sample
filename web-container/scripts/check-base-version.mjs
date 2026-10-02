#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('../current-client/manifest.json', import.meta.url));
const baseVersionFile = '/app/BASE_VERSION';

export function resolveBaseVersion({
  env = process.env,
  file = baseVersionFile,
  fileExists = existsSync,
  fileRead = readFileSync,
} = {}) {
  if (fileExists(file)) {
    return fileRead(file, 'utf8').trim();
  }
  if (env.BASE_VERSION) {
    return env.BASE_VERSION.trim();
  }
  throw new Error(
    '[check:base] versi base tidak ditemukan — jalankan di builder image (file /app/BASE_VERSION) atau set env BASE_VERSION.',
  );
}

export function assertCompatible(manifestVersion, baseVersion) {
  if (!manifestVersion) {
    throw new Error('[check:base] manifest.json tidak punya field "baseVersion".');
  }
  if (manifestVersion !== baseVersion) {
    throw new Error(
      `[check:base] baseVersion manifest (${manifestVersion}) != base image (${baseVersion}). Bump "baseVersion" di manifest.json atau pakai tag base yang benar.`,
    );
  }
  return true;
}

export function readManifestBaseVersion(path = manifestPath, fileRead = readFileSync) {
  const manifest = JSON.parse(fileRead(path, 'utf8'));
  return manifest.baseVersion;
}

function main() {
  const baseVersion = resolveBaseVersion();
  const manifestVersion = readManifestBaseVersion();
  assertCompatible(manifestVersion, baseVersion);
  console.log(
    `[check:base] OK — manifest baseVersion ${manifestVersion} cocok dengan base image.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
