import { describe, expect, it } from 'vitest';

import { buildDevConfig, csvModules, loadBaseConfig } from './dev-config.mjs';

const base = {
  client: 'client-a',
  modules: ['user-management', 'product-management', 'module-sample', 'registry-admin'],
  apiBase: 'https://dummyjson.com',
  registryUrl: 'http://localhost:4310/registry.json',
  registryAdminUrl: 'http://localhost:4310',
  featureFlags: { enableAuditLive: true, extraFlag: false },
};

describe('csvModules', () => {
  it('memakai fallback saat kosong', () => {
    expect(csvModules(undefined)).toEqual(['user-management']);
    expect(csvModules('   ')).toEqual(['user-management']);
  });

  it('memisah dan memangkas CSV', () => {
    expect(csvModules('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('loadBaseConfig', () => {
  it('null bila file tidak ada', () => {
    expect(loadBaseConfig('/x', { exists: () => false })).toBeNull();
  });

  it('null bila JSON invalid', () => {
    expect(loadBaseConfig('/x', { exists: () => true, read: () => 'not-json' })).toBeNull();
  });

  it('membaca object JSON', () => {
    expect(loadBaseConfig('/x', { exists: () => true, read: () => '{"a":1}' })).toEqual({ a: 1 });
  });
});

describe('buildDevConfig', () => {
  it('memakai base public/config.json saat env kosong', () => {
    const config = buildDevConfig({ clientId: 'client-a', env: {}, base });
    expect(config.modules).toEqual(base.modules);
    expect(config.apiBase).toBe('https://dummyjson.com');
    expect(config.registryUrl).toBe('http://localhost:4310/registry.json');
    expect(config.registryAdminUrl).toBe('http://localhost:4310');
    expect(config.featureFlags).toEqual({ enableAuditLive: true, extraFlag: false });
  });

  it('env menimpa base per-field', () => {
    const config = buildDevConfig({
      clientId: 'client-a',
      env: {
        VITE_MODULES: 'user-management,module-sample',
        VITE_API_BASE: 'https://api.example.com',
        VITE_ENABLE_AUDIT_LIVE: 'false',
        VITE_REGISTRY_URL: 'https://cdn.example/registry.json',
      },
      base,
    });
    expect(config.modules).toEqual(['user-management', 'module-sample']);
    expect(config.apiBase).toBe('https://api.example.com');
    expect(config.featureFlags).toEqual({ enableAuditLive: false, extraFlag: false });
    expect(config.registryUrl).toBe('https://cdn.example/registry.json');
    expect(config.registryAdminUrl).toBe('http://localhost:4310');
  });

  it('fallback default bila base tidak ada', () => {
    const config = buildDevConfig({ clientId: 'base', env: {}, base: null });
    expect(config.modules).toEqual(['user-management']);
    expect(config.apiBase).toBe('https://dummyjson.com');
    expect(config.featureFlags).toEqual({ enableAuditLive: true });
  });

  it('VITE_CONFIG_JSON menang penuh', () => {
    const config = buildDevConfig({
      clientId: 'client-a',
      env: { VITE_CONFIG_JSON: '{"client":"x","modules":["a"]}', VITE_MODULES: 'b' },
      base,
    });
    expect(config).toEqual({ client: 'x', modules: ['a'] });
  });

  it('VITE_CONFIG_JSON invalid melempar error', () => {
    expect(() =>
      buildDevConfig({ clientId: 'client-a', env: { VITE_CONFIG_JSON: 'not-json' }, base }),
    ).toThrow(/JSON object/);
  });
});
