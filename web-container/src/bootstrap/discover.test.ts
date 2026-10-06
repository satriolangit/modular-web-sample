import { describe, expect, it, vi } from 'vitest';

import type { Deps } from '../di/deps';
import { discover } from './discover';

vi.mock('@arsi/extension', () => ({ default: vi.fn(async () => {}) }));

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
  it('fails fast when config declares a module that is not wired', async () => {
    const deps = createFakeDeps(['not-a-real-module']);

    await expect(discover(deps, { registry: null })).rejects.toThrow(
      /not wired in moduleLoaders\.generated\.ts/,
    );
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
          fetchImpl: (async () => ({ text: async () => '{}' })) as unknown as typeof fetch,
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
