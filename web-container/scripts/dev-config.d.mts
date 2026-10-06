export const DEFAULT_DEV_MODULES: string[];
export const DEFAULT_DEV_API_BASE: string;

export function csvModules(value: string | undefined, fallback?: string[]): string[];

export interface LoadBaseConfigDeps {
  exists?: (path: string) => boolean;
  read?: (path: string, encoding: string) => string;
}

export function loadBaseConfig(
  publicDir: string,
  deps?: LoadBaseConfigDeps,
): Record<string, unknown> | null;

export interface BuildDevConfigOptions {
  clientId: string;
  env?: Record<string, string | undefined>;
  base?: Record<string, unknown> | null;
}

export function buildDevConfig(options: BuildDevConfigOptions): Record<string, unknown>;
