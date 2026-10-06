import type { Deps } from '../di/deps';
import { moduleLoaders, type InitHook } from './moduleLoaders.generated';
import {
  fetchRegistry,
  loadInstalledModule,
  resolveRegistryUrl,
  type LoadInstalledModuleOptions,
  type RegistryFile,
} from './runtimeModules';

export type { InitHook } from './moduleLoaders.generated';

interface ModuleEntryPoint {
  default: InitHook;
}

export interface DiscoverOptions {
  registry?: RegistryFile | null;
  loader?: Omit<LoadInstalledModuleOptions, 'name' | 'module' | 'deps'>;
}

const extensionLoader = (): Promise<ModuleEntryPoint> => import('@arsi/extension');

async function loadRegistry(deps: Deps, options: DiscoverOptions): Promise<RegistryFile | null> {
  if (options.registry !== undefined) {
    return options.registry;
  }
  try {
    return await fetchRegistry(resolveRegistryUrl(deps.config));
  } catch (error) {
    deps.logger.warn(`[bootstrap] registry tidak bisa dibaca: ${(error as Error).message}`);
    return null;
  }
}

export async function discover(deps: Deps, options: DiscoverOptions = {}): Promise<void> {
  const registry = await loadRegistry(deps, options);

  for (const moduleName of deps.config.modules) {
    const load = moduleLoaders[moduleName];
    if (load) {
      if (registry?.modules[moduleName]) {
        deps.logger.debug(
          `module "${moduleName}" built-in precedence: registry entry ${registry.modules[moduleName].version} ignored`,
        );
      }
      const entry = await load();
      await entry.default(deps);
      deps.logger.info(`module "${moduleName}" initialized (built-in)`);
      continue;
    }

    if (registry === null) {
      deps.logger.warn(`module "${moduleName}" unavailable: registry not reachable; skipped`);
      continue;
    }

    const installed = registry.modules[moduleName];
    if (installed && installed.enabled === false) {
      deps.logger.warn(`module "${moduleName}" disabled in registry; skipped`);
      continue;
    }

    if (installed) {
      try {
        await loadInstalledModule({
          name: moduleName,
          module: installed,
          deps,
          ...options.loader,
        });
        deps.logger.info(`module "${moduleName}" initialized (registry ${installed.version})`);
      } catch (error) {
        deps.logger.error(
          `module "${moduleName}" gagal dimuat dari registry: ${(error as Error).message}`,
        );
      }
      continue;
    }

    throw new Error(
      `[bootstrap] module "${moduleName}" is declared in config.modules but is not wired in moduleLoaders.generated.ts (run \`npm run gen:modules\`) and not found in the registry`,
    );
  }

  const extension = await extensionLoader();
  await extension.default(deps);
  deps.logger.info(`extension for client "${deps.config.client}" initialized`);
}
