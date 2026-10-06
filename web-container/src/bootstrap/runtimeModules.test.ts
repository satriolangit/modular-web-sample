import { describe, expect, it, vi } from 'vitest';

import type { Deps } from '../di/deps';
import {
  loadInstalledModule,
  parseRegistry,
  resolveRegistryUrl,
} from './runtimeModules';

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

describe('loadInstalledModule', () => {
  const deps = {} as Deps;

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
        fetchImpl: (async () => ({ text: async () => '{}' })) as unknown as typeof fetch,
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
      fetchImpl: (async () => ({ text: async () => '{}' })) as unknown as typeof fetch,
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
