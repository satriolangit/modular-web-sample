import type { Deps } from '@arsi/container';

import en from './i18n/en.json';
import id from './i18n/id.json';
import { ExtensionSamplePage } from './pages/ExtensionSamplePage';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.logger.info(`extension "${deps.config.client}" initialized`);

  // Sample extension-only feature: route + menu yang hanya ada di extension.
  // Namespace i18n & prefix route memakai id klien runtime — tanpa edit manual.
  // Hapus blok ini bila tidak dipakai.
  const featurePath = `/${deps.config.client}/sample`;

  deps.i18n.addResourceBundle('en', deps.config.client, en, true, true);
  deps.i18n.addResourceBundle('id', deps.config.client, id, true, true);

  deps.routes.add({
    path: featurePath,
    element: <ExtensionSamplePage />,
    meta: { group: deps.config.client, module: deps.config.client },
  });

  deps.menu.register({
    path: featurePath,
    label: 'menu.sample',
    namespace: deps.config.client,
    order: 90,
  });
}
