import type { AppConfig } from '../config/types';
import type { Deps } from '../di/deps';
import type { InitHook } from './moduleLoaders.generated';

export const RUNTIME_API_VERSION = 1;

export interface RegistryModule {
  version: string;
  apiVersion: number;
  manifest: string;
  integrity: string;
  css?: string[];
  enabled?: boolean;
}

export interface RegistryFile {
  apiVersion: number;
  modules: Record<string, RegistryModule>;
}

export function parseRegistry(value: unknown): RegistryFile | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { apiVersion?: unknown; modules?: unknown };
  if (typeof candidate.apiVersion !== 'number') return null;
  if (typeof candidate.modules !== 'object' || candidate.modules === null) return null;
  const modules: Record<string, RegistryModule> = {};
  for (const [name, entry] of Object.entries(candidate.modules)) {
    const item = entry as Partial<RegistryModule>;
    if (
      typeof item.version !== 'string' ||
      typeof item.apiVersion !== 'number' ||
      typeof item.manifest !== 'string' ||
      typeof item.integrity !== 'string'
    ) {
      continue;
    }
    modules[name] = {
      version: item.version,
      apiVersion: item.apiVersion,
      manifest: item.manifest,
      integrity: item.integrity,
      css: Array.isArray(item.css) ? item.css.filter((u): u is string => typeof u === 'string') : [],
      enabled: item.enabled !== false,
    };
  }
  return { apiVersion: candidate.apiVersion, modules };
}

export function resolveRegistryUrl(config: Pick<AppConfig, 'registryUrl'>): string {
  return config.registryUrl?.trim() || '/modules/registry.json';
}

export async function fetchRegistry(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RegistryFile | null> {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) return null;
  return parseRegistry(await response.json());
}

export async function verifySha384(text: string, expected: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-384', new TextEncoder().encode(text));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return expected === `sha384-${base64}`;
}

export function injectCss(urls: string[]): void {
  for (const url of urls) {
    if (document.querySelector(`link[data-runtime-module-css="${url}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.runtimeModuleCss = url;
    document.head.appendChild(link);
  }
}

export interface LoadInstalledModuleOptions {
  name: string;
  module: RegistryModule;
  deps: Deps;
  fetchImpl?: typeof fetch;
  verifyIntegrityImpl?: (text: string, expected: string) => Promise<boolean>;
  registerRemotesImpl?: (name: string, entry: string) => void;
  loadRemoteImpl?: (request: string) => Promise<{ default: InitHook }>;
  injectCssImpl?: (urls: string[]) => void;
}

async function defaultRegisterRemotes(name: string, entry: string): Promise<void> {
  const { registerRemotes } = await import('@module-federation/enhanced/runtime');
  registerRemotes([{ name, entry }]);
}

async function defaultLoadRemote(request: string): Promise<{ default: InitHook }> {
  const { loadRemote } = await import('@module-federation/enhanced/runtime');
  const entry = await loadRemote<{ default: InitHook }>(request);
  if (!entry) {
    throw new Error(`[runtime-module] remote "${request}" returned no entry point`);
  }
  return entry;
}

export async function loadInstalledModule(options: LoadInstalledModuleOptions): Promise<void> {
  const { name, module, deps } = options;
  if (module.apiVersion !== RUNTIME_API_VERSION) {
    throw new Error(
      `[runtime-module] "${name}" apiVersion ${module.apiVersion} != container ${RUNTIME_API_VERSION}`,
    );
  }
  const response = await (options.fetchImpl ?? fetch)(module.manifest, { cache: 'no-store' });
  const manifestText = await response.text();
  const valid = await (options.verifyIntegrityImpl ?? verifySha384)(manifestText, module.integrity);
  if (!valid) {
    throw new Error(`[runtime-module] "${name}" integrity mismatch (${module.manifest})`);
  }
  (options.injectCssImpl ?? injectCss)(module.css ?? []);
  if (options.registerRemotesImpl) {
    options.registerRemotesImpl(name, module.manifest);
  } else {
    await defaultRegisterRemotes(name, module.manifest);
  }
  const entry = await (options.loadRemoteImpl ?? defaultLoadRemote)(`${name}/entry`);
  await entry.default(deps);
}
