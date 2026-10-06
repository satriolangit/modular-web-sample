import { describe, expect, it, vi } from 'vitest';

import type { Deps } from '../di/deps';
import {
  fetchRegistry,
  loadInstalledModule,
  parseRegistry,
  resolveRegistryUrl,
} from './runtimeModules';

const okFetch = (text = '{}') =>
  (async () => ({ ok: true, status: 200, text: async () => text })) as unknown as typeof fetch;

const baseModule = {
  version: '0.1.0',
  apiVersion: 1,
  manifest: 'http://localhost:4174/module-runtime-demo/mf-manifest.json',
  integrity: 'sha384-AAAA',
  css: ['http://localhost:4174/module-runtime-demo/module.css'],
  enabled: true,
};

describe('parseRegistry', () => {
  it('menerima registry valid', () => {
    const parsed = parseRegistry({ apiVersion: 1, modules: { demo: baseModule } });
    expect(parsed?.modules.demo.version).toBe('0.1.0');
  });

  it('menolak nilai bukan object', () => {
    expect(parseRegistry('nope')).toBeNull();
    expect(parseRegistry({ apiVersion: 'x', modules: {} })).toBeNull();
  });
});

describe('resolveRegistryUrl', () => {
  it('default ke /modules/registry.json', () => {
    expect(resolveRegistryUrl({})).toBe('/modules/registry.json');
  });

  it('memakai registryUrl bila diisi', () => {
    expect(resolveRegistryUrl({ registryUrl: ' https://cdn.example/registry.json ' })).toBe(
      'https://cdn.example/registry.json',
    );
  });
});

describe('fetchRegistry', () => {
  it('mengembalikan null untuk 404 (deployment tanpa registry)', async () => {
    const result = await fetchRegistry(
      'http://localhost/registry.json',
      (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch,
    );
    expect(result).toBeNull();
  });

  it('gagal dengan pesan status untuk non-OK selain 404', async () => {
    await expect(
      fetchRegistry(
        'http://localhost/registry.json',
        (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch,
      ),
    ).rejects.toThrow('[runtime-module] registry request failed: 500');
  });

  it('parse registry saat response OK', async () => {
    const result = await fetchRegistry(
      'http://localhost/registry.json',
      (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ apiVersion: 1, modules: { demo: baseModule } }),
      })) as unknown as typeof fetch,
    );
    expect(result?.modules.demo.version).toBe('0.1.0');
  });
});

describe('loadInstalledModule', () => {
  const deps = {} as Deps;

  it('gagal dengan pesan manifest request (bukan integrity) untuk non-OK', async () => {
    await expect(
      loadInstalledModule({
        name: 'demo',
        module: baseModule,
        deps,
        fetchImpl: (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch,
      }),
    ).rejects.toThrow('[runtime-module] manifest request failed: 500');
  });

  it('gagal bila apiVersion tidak cocok', async () => {
    await expect(
      loadInstalledModule({ name: 'demo', module: { ...baseModule, apiVersion: 99 }, deps }),
    ).rejects.toThrow(/apiVersion/);
  });

  it('gagal bila integritas tidak cocok', async () => {
    await expect(
      loadInstalledModule({
        name: 'demo',
        module: baseModule,
        deps,
        fetchImpl: okFetch(),
        verifyIntegrityImpl: async () => false,
      }),
    ).rejects.toThrow(/integrity/);
  });

  it('memuat remote dan memanggil init(deps)', async () => {
    const init = vi.fn(async () => {});
    const registerRemotesImpl = vi.fn();
    const injectCssImpl = vi.fn();
    await loadInstalledModule({
      name: 'demo',
      module: baseModule,
      deps,
      fetchImpl: okFetch(),
      verifyIntegrityImpl: async () => true,
      registerRemotesImpl,
      loadRemoteImpl: async (request) => {
        expect(request).toBe('demo/entry');
        return { default: init };
      },
      injectCssImpl,
    });
    expect(registerRemotesImpl).toHaveBeenCalledWith('demo', baseModule.manifest);
    expect(injectCssImpl).toHaveBeenCalledWith(baseModule.css);
    expect(init).toHaveBeenCalledWith(deps);
  });
});
