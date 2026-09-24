import { describe, expect, it } from 'vitest';

import { productKeys } from './queryKeys';

describe('productKeys', () => {
  it('namespaces the root key by module and entity', () => {
    expect(productKeys.all).toEqual(['product-management', 'product']);
  });

  it('builds list keys under the namespace', () => {
    expect(productKeys.list({ limit: 10 })).toEqual([
      'product-management',
      'product',
      'list',
      { limit: 10 },
    ]);
  });

  it('builds detail keys under the namespace', () => {
    expect(productKeys.detail(7)).toEqual(['product-management', 'product', 'detail', 7]);
  });

  it('builds the categories key under the namespace', () => {
    expect(productKeys.categories()).toEqual(['product-management', 'product', 'categories']);
  });
});
