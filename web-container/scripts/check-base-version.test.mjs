import { describe, expect, it } from 'vitest';

import {
  assertCompatible,
  readManifestBaseVersion,
  resolveBaseVersion,
} from './check-base-version.mjs';

describe('assertCompatible', () => {
  it('lolos saat versi sama', () => {
    expect(assertCompatible('0.1.0', '0.1.0')).toBe(true);
  });

  it('gagal saat versi beda', () => {
    expect(() => assertCompatible('0.1.0', '0.2.0')).toThrow(/baseVersion manifest/);
  });

  it('gagal saat manifest tidak punya baseVersion', () => {
    expect(() => assertCompatible(undefined, '0.1.0')).toThrow(/tidak punya field/);
  });
});

describe('resolveBaseVersion', () => {
  it('prioritas file /app/BASE_VERSION', () => {
    const version = resolveBaseVersion({
      file: '/app/BASE_VERSION',
      fileExists: (p) => p === '/app/BASE_VERSION',
      fileRead: () => '0.1.0\n',
      env: { BASE_VERSION: '9.9.9' },
    });
    expect(version).toBe('0.1.0');
  });

  it('fallback env BASE_VERSION', () => {
    const version = resolveBaseVersion({
      file: '/app/BASE_VERSION',
      fileExists: () => false,
      env: { BASE_VERSION: '0.2.0' },
    });
    expect(version).toBe('0.2.0');
  });

  it('gagal bila tidak ada keduanya', () => {
    expect(() => resolveBaseVersion({ fileExists: () => false, env: {} })).toThrow(
      /tidak ditemukan/,
    );
  });
});

describe('readManifestBaseVersion', () => {
  it('membaca field baseVersion', () => {
    expect(
      readManifestBaseVersion('/fake/manifest.json', () =>
        JSON.stringify({ baseVersion: '0.1.0' }),
      ),
    ).toBe('0.1.0');
  });
});
