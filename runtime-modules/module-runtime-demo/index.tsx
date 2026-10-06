import type { Deps } from '@arsi/container';

import en from './i18n/en.json';
import id from './i18n/id.json';
import { RuntimeDemoPage } from './pages/RuntimeDemoPage';
import { setRuntime } from './runtime';

export default async function init(deps: Deps): Promise<void> {
  setRuntime(deps.runtime);
  deps.i18n.addResourceBundle('en', 'runtime-demo', en, true, true);
  deps.i18n.addResourceBundle('id', 'runtime-demo', id, true, true);
  deps.menu.register({ path: '/runtime-demo', label: 'Runtime Demo', order: 90 });
  deps.routes.add({
    path: '/runtime-demo',
    element: <RuntimeDemoPage />,
    meta: { group: 'runtime', module: 'runtime-demo' },
  });
}
