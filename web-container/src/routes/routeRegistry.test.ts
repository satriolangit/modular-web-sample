import { describe, expect, it } from 'vitest';

import { createRouteRegistry } from './routeRegistry';

describe('createRouteRegistry', () => {
  it('adds routes and returns them in insertion order', () => {
    const registry = createRouteRegistry();

    registry.add({ path: '/users', element: 'list', meta: { module: 'user-management' } });
    registry.add({ path: '/users/:id', element: 'detail' });

    expect(registry.getRoutes().map((route) => route.path)).toEqual(['/users', '/users/:id']);
  });

  it('throws when adding a duplicate path', () => {
    const registry = createRouteRegistry();
    registry.add({ path: '/users', element: 'list' });

    expect(() => registry.add({ path: '/users', element: 'other' })).toThrow(
      /already registered/,
    );
  });

  it('replaces the element when overriding an existing route', () => {
    const registry = createRouteRegistry();
    registry.add({ path: '/users/:id', element: 'detail' });

    registry.override('/users/:id', { element: 'client-detail' });

    expect(registry.getRoutes()[0].element).toBe('client-detail');
  });

  it('throws when overriding an unknown route', () => {
    const registry = createRouteRegistry();

    expect(() => registry.override('/missing', { element: 'x' })).toThrow(
      /cannot override unknown route/,
    );
  });
});
