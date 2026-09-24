import axios from 'axios';
import type { Deps } from '@arsi/container';
import {
  userEvents,
  userKeys,
  userSlots,
  type UserUpdatedPayload,
} from '@arsi/module-user-management';

import { AuditButton } from './components/AuditButton';
import en from './i18n/en.json';
import id from './i18n/id.json';
import { ClientAUserDetail } from './overrides/user-management/ClientAUserDetail';

let initialized = false;

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

  deps.routes.override('/users/:id', {
    element: <ClientAUserDetail />,
    meta: { group: 'user', module: 'user-management' },
  });

  deps.events.on<UserUpdatedPayload>(userEvents.updated, (payload) => {
    void deps.queryClient.invalidateQueries({ queryKey: userKeys.detail(payload.id) });
    deps.logger.info('client-a: user updated', payload);
  });
}
