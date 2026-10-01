import type { ReactNode } from 'react';

import { SampleApiPage } from './SampleApiPage';
import { SampleApiRegistryPage } from './SampleApiRegistryPage';
import { SampleEventsPage } from './SampleEventsPage';
import { SampleI18nPage } from './SampleI18nPage';
import { SampleLoggerPage } from './SampleLoggerPage';
import { SampleModalPage } from './SampleModalPage';
import { SampleNotificationsPage } from './SampleNotificationsPage';
import { SampleQueryPage } from './SampleQueryPage';
import { SampleSlotsPage } from './SampleSlotsPage';
import { SampleStorePage } from './SampleStorePage';
import { SampleToastPage } from './SampleToastPage';

export interface SamplePageDefinition {
  path: string;
  labelKey: string;
  descriptionKey: string;
  element: ReactNode;
}

export const samplePages: SamplePageDefinition[] = [
  {
    path: '/module-sample/api',
    labelKey: 'nav.api',
    descriptionKey: 'navDesc.api',
    element: <SampleApiPage />,
  },
  {
    path: '/module-sample/api-registry',
    labelKey: 'nav.apiRegistry',
    descriptionKey: 'navDesc.apiRegistry',
    element: <SampleApiRegistryPage />,
  },
  {
    path: '/module-sample/query',
    labelKey: 'nav.query',
    descriptionKey: 'navDesc.query',
    element: <SampleQueryPage />,
  },
  {
    path: '/module-sample/store',
    labelKey: 'nav.store',
    descriptionKey: 'navDesc.store',
    element: <SampleStorePage />,
  },
  {
    path: '/module-sample/toast',
    labelKey: 'nav.toast',
    descriptionKey: 'navDesc.toast',
    element: <SampleToastPage />,
  },
  {
    path: '/module-sample/modal',
    labelKey: 'nav.modal',
    descriptionKey: 'navDesc.modal',
    element: <SampleModalPage />,
  },
  {
    path: '/module-sample/notifications',
    labelKey: 'nav.notifications',
    descriptionKey: 'navDesc.notifications',
    element: <SampleNotificationsPage />,
  },
  {
    path: '/module-sample/events',
    labelKey: 'nav.events',
    descriptionKey: 'navDesc.events',
    element: <SampleEventsPage />,
  },
  {
    path: '/module-sample/slots',
    labelKey: 'nav.slots',
    descriptionKey: 'navDesc.slots',
    element: <SampleSlotsPage />,
  },
  {
    path: '/module-sample/i18n',
    labelKey: 'nav.i18n',
    descriptionKey: 'navDesc.i18n',
    element: <SampleI18nPage />,
  },
  {
    path: '/module-sample/logger',
    labelKey: 'nav.logger',
    descriptionKey: 'navDesc.logger',
    element: <SampleLoggerPage />,
  },
];
