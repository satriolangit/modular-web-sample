import axios from 'axios';
import type { Deps } from '@arsi/container';

import { SampleInfoModal } from './components/SampleInfoModal';
import { sampleEvents, type SamplePostCreatedPayload } from './events';
import en from './i18n/en.json';
import id from './i18n/id.json';
import { sampleModals } from './modals';
import { SampleOverviewPage } from './pages/SampleOverviewPage';
import { samplePages } from './pages/samplePages';

let initialized = false;

export default async function init(deps: Deps): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  deps.i18n.addResourceBundle('en', 'module-sample', en, true, true);
  deps.i18n.addResourceBundle('id', 'module-sample', id, true, true);

  const sampleClient = axios.create({
    baseURL: deps.config.apiBase,
    timeout: 8000,
  });
  deps.apiRegistry.register('module-sample', sampleClient);

  deps.menu.register({
    path: '/module-sample',
    label: 'menu.root',
    namespace: 'module-sample',
    order: 30,
  });

  deps.routes.add({
    path: '/module-sample',
    element: <SampleOverviewPage />,
    meta: { group: 'sample', module: 'module-sample' },
  });

  for (const page of samplePages) {
    deps.routes.add({
      path: page.path,
      element: page.element,
      meta: { group: 'sample', module: 'module-sample' },
    });
  }

  deps.modal.register(sampleModals.info, SampleInfoModal);

  deps.events.on<SamplePostCreatedPayload>(sampleEvents.postCreated, (payload) => {
    deps.logger.info('module-sample: post created', payload);
  });
}
