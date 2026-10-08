import axios from 'axios';
import type { Deps } from '@arsi/container';
import { sampleSlots } from '@arsi/module-module-sample';
import {
  userEvents,
  userKeys,
  userSlots,
  type UserUpdatedPayload,
} from '@arsi/module-user-management';

import { AuditButton } from './components/AuditButton';
import { ClientAExtensionPointsPage } from './components/ClientAExtensionPointsPage';
import { ClientASamplePanel } from './components/ClientASamplePanel';
import en from './i18n/en.json';
import id from './i18n/id.json';
import { ClientAUserDetail } from './overrides/user-management/ClientAUserDetail';
import { ClientAReportsPage } from './pages/ClientAReportsPage';

let initialized = false;

function overrideIfPresent(
  deps: Deps,
  path: string,
  definition: Parameters<Deps['routes']['override']>[1],
): void {
  if (!deps.routes.has(path)) {
    deps.logger.warn(`[client-a] route "${path}" belum terdaftar; override dilewati`);
    return;
  }
  deps.routes.override(path, definition);
}

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.i18n.addResourceBundle('en', 'client-a', en, true, true);
  deps.i18n.addResourceBundle('id', 'client-a', id, true, true);

  deps.i18n.addResourceBundle(
    'en',
    'user-management',
    { title: 'Client A Users', menu: { users: 'Client A Users' } },
    true,
    true,
  );
  deps.i18n.addResourceBundle(
    'id',
    'user-management',
    { title: 'Pengguna Client A', menu: { users: 'Pengguna Client A' } },
    true,
    true,
  );

  const auditClient = axios.create({
    baseURL: '/api/audit-client-a',
    timeout: 5000,
  });
  deps.apiRegistry.register('client-a.audit', auditClient);

  deps.slots.register(userSlots.userTableActions, AuditButton);

  overrideIfPresent(deps, '/users/:id', {
    element: <ClientAUserDetail />,
    meta: { group: 'user', module: 'user-management' },
  });

  // Tier 1 — slot: isi extension point milik module-sample.
  deps.slots.register(sampleSlots.overviewPanel, ClientASamplePanel);

  // Tier 2 — route override: ganti halaman extension-points milik module-sample.
  overrideIfPresent(deps, '/module-sample/extension-points', {
    element: <ClientAExtensionPointsPage />,
    meta: { group: 'sample', module: 'module-sample' },
  });

  // Fitur extension-only: halaman + menu yang hanya ada di extension ini.
  deps.routes.add({
    path: '/client-a/reports',
    element: <ClientAReportsPage />,
    meta: { group: 'client-a', module: 'client-a' },
  });

  deps.menu.register({
    path: '/client-a/reports',
    label: 'menu.reports',
    namespace: 'client-a',
    order: 90,
  });

  deps.events.on<UserUpdatedPayload>(userEvents.updated, (payload) => {
    void deps.queryClient.invalidateQueries({ queryKey: userKeys.detail(payload.id) });
    deps.logger.info('client-a: user updated', payload);
  });
}
