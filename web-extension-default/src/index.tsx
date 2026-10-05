import type { Deps } from '@arsi/container';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.logger.info(`extension "${deps.config.client}" initialized`);
}
