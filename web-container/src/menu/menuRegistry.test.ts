import { describe, expect, it } from 'vitest';

import { createMenuRegistry } from './menuRegistry';

describe('createMenuRegistry', () => {
  it('returns menu items sorted by order', () => {
    const registry = createMenuRegistry();

    registry.register({ path: '/users', label: 'menu.users', order: 20 });
    registry.register({ path: '/', label: 'menu.home', order: 10 });

    expect(registry.getAll().map((item) => item.path)).toEqual(['/', '/users']);
  });

  it('throws when registering a duplicate path', () => {
    const registry = createMenuRegistry();
    registry.register({ path: '/users', label: 'menu.users' });

    expect(() => registry.register({ path: '/users', label: 'other' })).toThrow(
      /already registered/,
    );
  });
});
