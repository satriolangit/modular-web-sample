import { describe, expect, it, vi } from 'vitest';

import type { Deps } from '../di/deps';
import { discover } from './discover';

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

    await expect(discover(deps)).rejects.toThrow(/not wired in discover\.ts/);
  });
});
