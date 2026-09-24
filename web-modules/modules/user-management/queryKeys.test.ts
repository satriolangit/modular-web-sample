import { describe, expect, it } from 'vitest';

import { userKeys } from './queryKeys';

describe('userKeys', () => {
  it('namespaces the root key by module and entity', () => {
    expect(userKeys.all).toEqual(['user-management', 'user']);
  });

  it('builds list keys under the namespace', () => {
    expect(userKeys.list({ limit: 10 })).toEqual([
      'user-management',
      'user',
      'list',
      { limit: 10 },
    ]);
  });

  it('builds detail keys under the namespace', () => {
    expect(userKeys.detail(7)).toEqual(['user-management', 'user', 'detail', 7]);
  });
});
