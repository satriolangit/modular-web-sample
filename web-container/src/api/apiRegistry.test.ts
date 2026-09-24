import axios from 'axios';
import { describe, expect, it } from 'vitest';

import { createApiRegistry } from './apiRegistry';

describe('createApiRegistry', () => {
  it('registers and returns instances by name', () => {
    const registry = createApiRegistry();
    const instance = axios.create({ baseURL: '/api/test' });

    registry.register('test', instance);

    expect(registry.has('test')).toBe(true);
    expect(registry.get('test')).toBe(instance);
  });

  it('throws when registering a duplicate service name', () => {
    const registry = createApiRegistry();
    const instance = axios.create();

    registry.register('test', instance);

    expect(() => registry.register('test', instance)).toThrow(/already registered/);
  });

  it('throws when getting an unregistered service', () => {
    const registry = createApiRegistry();

    expect(registry.has('missing')).toBe(false);
    expect(() => registry.get('missing')).toThrow(/not registered/);
  });
});
