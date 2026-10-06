import { describe, expect, it, vi } from 'vitest';

import type { Deps } from '../di/deps';
import { discover } from './discover';
import { moduleLoaders } from './moduleLoaders.generated';

vi.mock('@arsi/extension', () => ({ default: vi.fn(async () => {}) }));

vi.mock('./moduleLoaders.generated', () => ({
  moduleLoaders: {
    'user-management': vi.fn(async () => ({ default: async () => {} })),
  },
}));

function createFakeDeps(modules: string[]) {
  return {
    config: { client: 'test', modules, apiBase: '', featureFlags: {} },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    },
  } as unknown as Deps;
}

describe('discover', () => {
  it('fails fast when config declares a module absent from a loaded registry', async () => {
    const deps = createFakeDeps(['not-a-real-module']);

    await expect(discover(deps, { registry: { apiVersion: 1, modules: {} } })).rejects.toThrow(
      /not wired in moduleLoaders\.generated\.ts/,
    );
  });

  it('melewati (warn) module non-built-in saat registry tidak tersedia', async () => {
    const deps = createFakeDeps(['remote-only']);

    await expect(discover(deps, { registry: null })).resolves.toBeUndefined();

    expect(deps.logger.warn).toHaveBeenCalledWith(
      'module "remote-only" unavailable: registry not reachable; skipped',
    );
  });

  it('melewati (warn) module yang disabled di registry', async () => {
    const deps = createFakeDeps(['disabled-module']);

    await expect(
      discover(deps, {
        registry: {
          apiVersion: 1,
          modules: {
            'disabled-module': {
              version: '1.0.0',
              apiVersion: 1,
              manifest: 'http://127.0.0.1:1/mf-manifest.json',
              integrity: 'sha384-x',
              css: [],
              enabled: false,
            },
          },
        },
      }),
    ).resolves.toBeUndefined();

    expect(deps.logger.warn).toHaveBeenCalledWith(
      'module "disabled-module" disabled in registry; skipped',
    );
  });

  it('memprioritaskan built-in saat registry memuat nama yang sama', async () => {
    const deps = createFakeDeps(['user-management']);

    await discover(deps, {
      registry: {
        apiVersion: 1,
        modules: {
          'user-management': {
            version: '9.9.9',
            apiVersion: 1,
            manifest: 'http://127.0.0.1:1/mf-manifest.json',
            integrity: 'sha384-x',
            css: [],
            enabled: true,
          },
        },
      },
      loader: {
        fetchImpl: (async () => {
          throw new Error('registry loader tidak boleh dipakai untuk built-in');
        }) as unknown as typeof fetch,
      },
    });

    expect(moduleLoaders['user-management']).toHaveBeenCalledTimes(1);
    expect(deps.logger.info).toHaveBeenCalledWith('module "user-management" initialized (built-in)');
    expect(deps.logger.debug).toHaveBeenCalledWith(expect.stringContaining('built-in precedence'));
  });

  it('melewati installed module yang gagal dan tetap melanjutkan (fail-closed)', async () => {
    const deps = createFakeDeps(['broken-module']);

    await expect(
      discover(deps, {
        registry: {
          apiVersion: 1,
          modules: {
            'broken-module': {
              version: '1.0.0',
              apiVersion: 1,
              manifest: 'http://127.0.0.1:1/mf-manifest.json',
              integrity: 'sha384-x',
              css: [],
              enabled: true,
            },
          },
        },
        loader: {
          fetchImpl: (async () => ({
            ok: true,
            status: 200,
            text: async () => '{}',
          })) as unknown as typeof fetch,
          verifyIntegrityImpl: async () => true,
          registerRemotesImpl: () => {},
          loadRemoteImpl: async () => {
            throw new Error('boom');
          },
        },
      }),
    ).resolves.toBeUndefined();

    expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining('gagal dimuat'));
  });
});
