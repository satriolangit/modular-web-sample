import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';

export const RUNTIME_API_VERSION = 1;
export const REQUIRED_FILES = ['manifest.json', 'mf-manifest.json', 'remoteEntry.js'];

export class ValidationError extends Error {}

export function unzip(buffer) {
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new ValidationError('file bukan zip valid');
  }
  for (const entry of Object.keys(files)) {
    if (entry.startsWith('/') || entry.startsWith('\\') || entry.includes('\\')) {
      throw new ValidationError(`entry path tidak valid: ${entry}`);
    }
    const normalized = path.posix.normalize(entry);
    if (normalized.startsWith('..') || normalized.includes('/../')) {
      throw new ValidationError(`entry path tidak aman: ${entry}`);
    }
    if (entry.endsWith('/')) {
      delete files[entry];
    }
  }
  return files;
}

export function parseManifest(zipFiles) {
  const raw = zipFiles['manifest.json'];
  if (!raw) {
    throw new ValidationError('manifest.json tidak ada di zip');
  }
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new ValidationError('manifest.json bukan JSON valid');
  }
  if (typeof manifest.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
    throw new ValidationError('manifest.name tidak valid (kebab-case)');
  }
  if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new ValidationError('manifest.version bukan semver');
  }
  if (manifest.apiVersion !== RUNTIME_API_VERSION) {
    throw new ValidationError(`manifest.apiVersion ${manifest.apiVersion} != ${RUNTIME_API_VERSION}`);
  }
  if (manifest.entry !== 'remoteEntry.js') {
    throw new ValidationError('manifest.entry harus remoteEntry.js');
  }
  const css = Array.isArray(manifest.css) ? manifest.css : [];
  for (const file of [...REQUIRED_FILES, ...css]) {
    if (!(file in zipFiles)) {
      throw new ValidationError(`file wajib tidak ada di zip: ${file}`);
    }
  }
  if (!Object.keys(zipFiles).some((file) => file.startsWith('assets/') && file.endsWith('.js'))) {
    throw new ValidationError('zip harus memuat minimal satu assets/*.js');
  }
  return { manifest, css };
}

export function computeIntegrity(bytes) {
  return `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
}

export function extractTo(dir, zipFiles) {
  for (const [name, bytes] of Object.entries(zipFiles)) {
    const target = path.join(dir, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}
