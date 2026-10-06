import { DEFAULT_CONFIG, type AppConfig } from './types';

function normalizeConfig(value: unknown): AppConfig {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_CONFIG;
  }

  const candidate = value as Partial<AppConfig>;

  return {
    client: typeof candidate.client === 'string' ? candidate.client : DEFAULT_CONFIG.client,
    modules: Array.isArray(candidate.modules)
      ? candidate.modules.filter((item): item is string => typeof item === 'string')
      : DEFAULT_CONFIG.modules,
    apiBase: typeof candidate.apiBase === 'string' ? candidate.apiBase : DEFAULT_CONFIG.apiBase,
    featureFlags:
      candidate.featureFlags && typeof candidate.featureFlags === 'object'
        ? (candidate.featureFlags as Record<string, boolean>)
        : DEFAULT_CONFIG.featureFlags,
    registryUrl:
      typeof candidate.registryUrl === 'string' ? candidate.registryUrl : undefined,
  };
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`config request failed with status ${response.status}`);
    }
    const data: unknown = await response.json();
    return normalizeConfig(data);
  } catch (error) {
    console.warn('[config] falling back to default config', error);
    return DEFAULT_CONFIG;
  }
}
