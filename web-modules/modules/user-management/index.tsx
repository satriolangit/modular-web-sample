import axios from 'axios';
import type { Deps } from '@arsi/container';

import { CreateUserDialog } from './components/CreateUserDialog';
import en from './i18n/en.json';
import id from './i18n/id.json';
import { userModals } from './modals';
import { UserDetailPage } from './pages/UserDetailPage';
import { UserListPage } from './pages/UserListPage';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.i18n.addResourceBundle('en', 'user-management', en, true, true);
  deps.i18n.addResourceBundle('id', 'user-management', id, true, true);

  const userClient = axios.create({
    baseURL: deps.config.apiBase,
    timeout: 8000,
  });
  deps.apiRegistry.register('user', userClient);

  deps.menu.register({
    path: '/users',
    label: 'menu.users',
    namespace: 'user-management',
    order: 10,
  });

  deps.routes.add({
    path: '/users',
    element: <UserListPage />,
    meta: { group: 'user', module: 'user-management' },
  });

  deps.routes.add({
    path: '/users/:id',
    element: <UserDetailPage />,
    meta: { group: 'user', module: 'user-management' },
  });

  deps.modal.register(userModals.create, CreateUserDialog);
}
