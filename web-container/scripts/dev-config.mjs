import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_DEV_MODULES = ['user-management'];
export const DEFAULT_DEV_API_BASE = 'https://dummyjson.com';

export function csvModules(value, fallback = DEFAULT_DEV_MODULES) {
  if (typeof value !== 'string' || !value.trim()) {
    return [...fallback];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadBaseConfig(publicDir, { exists = existsSync, read = readFileSync } = {}) {
  const file = path.join(publicDir, 'config.json');
  if (!exists(file)) {
    return null;
  }
  try {
    const parsed = JSON.parse(read(file, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function buildDevConfig({ clientId, env = {}, base = null } = {}) {
  const rawJson = env.VITE_CONFIG_JSON?.trim();
  if (rawJson) {
    const compact = rawJson.replace(/[\r\n]+/g, '').trim();
    if (!(compact.startsWith('{') && compact.endsWith('}'))) {
      throw new Error(
        "[dev-config] VITE_CONFIG_JSON must be a JSON object (start with '{' and end with '}')",
      );
    }
    return JSON.parse(compact);
  }

  const baseConfig = base ?? {};
  const envModules = env.VITE_MODULES?.trim();
  const envApiBase = env.VITE_API_BASE?.trim();
  const envFlag = env.VITE_ENABLE_AUDIT_LIVE?.trim();
  const registryUrl = env.VITE_REGISTRY_URL?.trim() || baseConfig.registryUrl;
  const registryAdminUrl = env.VITE_REGISTRY_ADMIN_URL?.trim() || baseConfig.registryAdminUrl;
  const baseModules =
    Array.isArray(baseConfig.modules) && baseConfig.modules.length > 0
      ? baseConfig.modules
      : DEFAULT_DEV_MODULES;

  return {
    client: clientId,
    modules: envModules ? csvModules(envModules) : [...baseModules],
    apiBase: envApiBase || baseConfig.apiBase || DEFAULT_DEV_API_BASE,
    featureFlags: {
      enableAuditLive: true,
      ...(baseConfig.featureFlags ?? {}),
      ...(envFlag ? { enableAuditLive: envFlag !== 'false' } : {}),
    },
    ...(registryUrl ? { registryUrl } : {}),
    ...(registryAdminUrl ? { registryAdminUrl } : {}),
  };
}
