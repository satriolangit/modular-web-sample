import type { AxiosInstance } from 'axios';

export interface ApiRegistry {
  register(name: string, instance: AxiosInstance): void;
  get(name: string): AxiosInstance;
  has(name: string): boolean;
}

export function createApiRegistry(): ApiRegistry {
  const services = new Map<string, AxiosInstance>();

  return {
    register(name, instance) {
      if (services.has(name)) {
        throw new Error(`[apiRegistry] service "${name}" is already registered`);
      }
      services.set(name, instance);
    },
    get(name) {
      const instance = services.get(name);
      if (!instance) {
        throw new Error(`[apiRegistry] service "${name}" is not registered`);
      }
      return instance;
    },
    has: (name) => services.has(name),
  };
}
