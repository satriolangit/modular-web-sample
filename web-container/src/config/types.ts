export interface AppConfig {
  client: string;
  modules: string[];
  apiBase: string;
  featureFlags?: Record<string, boolean>;
  registryUrl?: string;
  registryAdminUrl?: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  client: 'default',
  modules: [],
  apiBase: '',
  featureFlags: {},
};
