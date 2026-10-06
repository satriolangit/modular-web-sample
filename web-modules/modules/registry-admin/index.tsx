import axios from 'axios';
import type { Deps } from '@arsi/container';

import { REGISTRY_ADMIN_TOKEN_KEY } from './constants';
import en from './i18n/en.json';
import id from './i18n/id.json';
import { ModuleRegistryPage } from './pages/ModuleRegistryPage';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.i18n.addResourceBundle('en', 'registry-admin', en, true, true);
  deps.i18n.addResourceBundle('id', 'registry-admin', id, true, true);

  if (deps.config.registryAdminUrl) {
    const client = axios.create({ baseURL: deps.config.registryAdminUrl });
    client.interceptors.request.use((request) => {
      const token = localStorage.getItem(REGISTRY_ADMIN_TOKEN_KEY);
      if (token) {
        request.headers.Authorization = `Bearer ${token}`;
      }
      return request;
    });
    deps.apiRegistry.register('registry-admin', client);
  }

  deps.menu.register({
    path: '/system/modules',
    label: 'menu',
    namespace: 'registry-admin',
    order: 99,
  });
  deps.routes.add({
    path: '/system/modules',
    element: <ModuleRegistryPage />,
    meta: { group: 'system', module: 'registry-admin' },
  });
}
