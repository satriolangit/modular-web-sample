import type { QueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import type { i18n as I18nInstance } from 'i18next';

import { createApi, createServiceClient } from '../api/createApi';
import { createApiRegistry, type ApiRegistry } from '../api/apiRegistry';
import type { AppConfig } from '../config/types';
import { isDev } from '../env';
import { createEventBus, type EventBus } from '../events/eventBus';
import { createI18nInstance } from '../i18n';
import { createLogger, type Logger } from '../logger/logger';
import { createMenuRegistry, type MenuRegistry } from '../menu/menuRegistry';
import { createModalService, type ModalService } from '../modal/modalService';
import {
  createNotificationService,
  type NotificationService,
} from '../notifications/notificationService';
import { createQueryClient } from '../query/queryClient';
import { createRouteRegistry, type RouteRegistry } from '../routes/routeRegistry';
import { createSlotRegistry, type SlotRegistry } from '../slots/slotRegistry';
import { createToastService, type ToastService } from '../toast/toastService';

export interface Deps {
  config: AppConfig;
  logger: Logger;
  api: AxiosInstance;
  apiRegistry: ApiRegistry;
  events: EventBus;
  i18n: I18nInstance;
  queryClient: QueryClient;
  toast: ToastService;
  modal: ModalService;
  notifications: NotificationService;
  slots: SlotRegistry;
  routes: RouteRegistry;
  menu: MenuRegistry;
}

export function createDeps(config: AppConfig): Deps {
  const logger = createLogger(config.client, isDev ? 'debug' : 'info');
  const events = createEventBus();
  const api = createApi(config, logger);
  const apiRegistry = createApiRegistry();

  apiRegistry.register('auth', createServiceClient('/api/auth'));

  const i18n = createI18nInstance();
  const queryClient = createQueryClient();
  const toast = createToastService();
  const modal = createModalService();
  const notifications = createNotificationService();
  const slots = createSlotRegistry();
  const routes = createRouteRegistry();
  const menu = createMenuRegistry();

  return {
    config,
    logger,
    api,
    apiRegistry,
    events,
    i18n,
    queryClient,
    toast,
    modal,
    notifications,
    slots,
    routes,
    menu,
  };
}
