import { describe, expect, it } from 'vitest';

import { sampleKeys } from './queryKeys';

describe('sampleKeys', () => {
  it('namespaces the root key', () => {
    expect(sampleKeys.all).toEqual(['module-sample', 'sample']);
  });

  it('builds user and post keys', () => {
    expect(sampleKeys.user(3)).toEqual(['module-sample', 'sample', 'user', 3]);
    expect(sampleKeys.postList({ limit: 5 })).toEqual([
      'module-sample',
      'sample',
      'post',
      'list',
      { limit: 5 },
    ]);
    expect(sampleKeys.post(9)).toEqual(['module-sample', 'sample', 'post', 'detail', 9]);
  });
});
