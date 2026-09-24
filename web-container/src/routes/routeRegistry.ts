import type { ReactNode } from 'react';

export interface RouteMeta {
  group?: string;
  module?: string;
}

export interface RouteDefinition {
  path: string;
  element: ReactNode;
  meta?: RouteMeta;
}

export interface RouteRegistry {
  add(definition: RouteDefinition): void;
  override(path: string, definition: Omit<RouteDefinition, 'path'>): void;
  getRoutes(): RouteDefinition[];
  has(path: string): boolean;
}

export function createRouteRegistry(): RouteRegistry {
  const routes = new Map<string, RouteDefinition>();

  return {
    add({ path, element, meta }) {
      if (routes.has(path)) {
        throw new Error(`[routes] route "${path}" is already registered`);
      }
      routes.set(path, { path, element, meta });
    },
    override(path, definition) {
      if (!routes.has(path)) {
        throw new Error(`[routes] cannot override unknown route "${path}"`);
      }
      routes.set(path, { path, ...definition });
    },
    getRoutes: () => [...routes.values()],
    has: (path) => routes.has(path),
  };
}
