import type { Deps } from '../di/deps';
import { moduleLoaders, type InitHook } from './moduleLoaders.generated';

export type { InitHook } from './moduleLoaders.generated';

interface ModuleEntryPoint {
  default: InitHook;
}

const extensionLoader = (): Promise<ModuleEntryPoint> => import('@arsi/extension');

export async function discover(deps: Deps): Promise<void> {
  for (const moduleName of deps.config.modules) {
    const load = moduleLoaders[moduleName];
    if (!load) {
      throw new Error(
        `[bootstrap] module "${moduleName}" is declared in config.modules but is not wired in moduleLoaders.generated.ts (run \`npm run gen:modules\`)`,
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
