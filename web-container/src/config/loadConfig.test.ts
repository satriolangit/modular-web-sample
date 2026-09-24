import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from './loadConfig';

describe('loadConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and normalizes /config.json without caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        client: 'client-a',
        modules: ['user-management'],
        apiBase: 'https://dummyjson.com',
        featureFlags: { enableAuditLive: true },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const config = await loadConfig();

    expect(fetchMock).toHaveBeenCalledWith('/config.json', { cache: 'no-store' });
    expect(config.client).toBe('client-a');
    expect(config.modules).toEqual(['user-management']);
    expect(config.apiBase).toBe('https://dummyjson.com');
    expect(config.featureFlags).toEqual({ enableAuditLive: true });
  });

  it('drops malformed module entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ modules: ['user-management', 42, null] }),
      }),
    );

    const config = await loadConfig();

    expect(config.modules).toEqual(['user-management']);
  });

  it('falls back to defaults when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const config = await loadConfig();

    expect(config.client).toBe('default');
    expect(config.modules).toEqual([]);
  });

  it('falls back to defaults when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );

    const config = await loadConfig();

    expect(config.client).toBe('default');
  });
});
