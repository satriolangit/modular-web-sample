import type { Deps } from '../di/deps';

export type InitHook = (deps: Deps) => Promise<void> | void;

interface ModuleEntryPoint {
  default: InitHook;
}

const moduleLoaders: Record<string, () => Promise<ModuleEntryPoint>> = {
  'user-management': () => import('@arsi/module-user-management/entry'),
  'product-management': () => import('@arsi/module-product-management/entry'),
};

const extensionLoader = (): Promise<ModuleEntryPoint> => import('@arsi/extension');

export async function discover(deps: Deps): Promise<void> {
  for (const moduleName of deps.config.modules) {
    const load = moduleLoaders[moduleName];
    if (!load) {
      throw new Error(
        `[bootstrap] module "${moduleName}" is declared in config.modules but is not wired in discover.ts`,
      );
    }
    const entry = await load();
    await entry.default(deps);
    deps.logger.info(`module "${moduleName}" initialized`);
  }

  const extension = await extensionLoader();
  await extension.default(deps);
  deps.logger.info(`extension for client "${deps.config.client}" initialized`);
}
