export interface AppConfig {
  client: string;
  modules: string[];
  apiBase: string;
  featureFlags?: Record<string, boolean>;
}

export const DEFAULT_CONFIG: AppConfig = {
  client: 'default',
  modules: [],
  apiBase: '',
  featureFlags: {},
};
