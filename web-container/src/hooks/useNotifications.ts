import { useMemo, useSyncExternalStore } from 'react';

import { useDeps } from '../di/DepsContext';
import type { AppNotification, NotificationService } from '../notifications/notificationService';

export type UseNotificationsResult = NotificationService & {
  notifications: AppNotification[];
  unreadCount: number;
};

export function useNotifications(): UseNotificationsResult {
  const { notifications: service } = useDeps();
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const unreadCount = useMemo(
    () => snapshot.filter((item) => !item.read).length,
    [snapshot],
  );

  return useMemo(
    () => ({ ...service, notifications: snapshot, unreadCount }),
    [service, snapshot, unreadCount],
  );
}
