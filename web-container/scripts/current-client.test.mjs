import { describe, expect, it, vi } from 'vitest';

import {
  clientIdFromSymlinkTarget,
  normalizeClientId,
  readCurrentClient,
  resolveClientId,
} from './current-client.mjs';

describe('normalizeClientId', () => {
  it('menambah prefix client- untuk suffix', () => {
    expect(normalizeClientId('bcad')).toBe('client-bcad');
  });

  it('membiarkan id client-* apa adanya', () => {
    expect(normalizeClientId('client-bcad')).toBe('client-bcad');
  });

  it('memetakan base/default', () => {
    expect(normalizeClientId('base')).toBe('base');
    expect(normalizeClientId('default')).toBe('base');
  });

  it('menerima nama folder', () => {
    expect(normalizeClientId('web-extension-client-bcad')).toBe('client-bcad');
    expect(normalizeClientId('web-extension-default')).toBe('base');
  });

  it('null untuk nilai kosong', () => {
    expect(normalizeClientId('')).toBeNull();
    expect(normalizeClientId(undefined)).toBeNull();
  });
});

describe('clientIdFromSymlinkTarget', () => {
  it('folder client', () => {
    expect(clientIdFromSymlinkTarget('../web-extension-client-bcad')).toBe('client-bcad');
  });

  it('folder default', () => {
    expect(clientIdFromSymlinkTarget('../web-extension-default')).toBe('base');
  });

  it('target tak dikenal', () => {
    expect(clientIdFromSymlinkTarget('../lain')).toBeNull();
  });
});

describe('readCurrentClient', () => {
  const deps = (target) => ({
    root: '/repo/web-container',
    exists: () => true,
    readlink: () => target,
  });

  it('membaca symlink valid', () => {
    const result = readCurrentClient(deps('../web-extension-client-bcad'));
    expect(result.id).toBe('client-bcad');
    expect(result.target).toBe('../web-extension-client-bcad');
  });

  it('gagal bila symlink tidak ada', () => {
    expect(() => readCurrentClient({ exists: () => false })).toThrow(/tidak ditemukan/);
  });

  it('gagal bila target tidak dikenal', () => {
    expect(() => readCurrentClient(deps('../lain'))).toThrow(/bukan folder/);
  });
});

describe('resolveClientId', () => {
  it('env menang dan memperingatkan bila beda symlink', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = resolveClientId({
      env: { VITE_CLIENT: 'bcad' },
      exists: () => true,
      readlink: () => '../web-extension-client-lain',
    });
    expect(result.id).toBe('client-bcad');
    expect(result.source).toBe('env');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('fallback ke symlink', () => {
    const result = resolveClientId({
      env: {},
      exists: () => true,
      readlink: () => '../web-extension-client-bcad',
    });
    expect(result.id).toBe('client-bcad');
    expect(result.source).toBe('symlink');
  });
});
