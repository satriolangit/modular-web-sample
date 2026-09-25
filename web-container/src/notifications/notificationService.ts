export type NotificationVariant = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  variant: NotificationVariant;
  source?: string;
  createdAt: number;
  read: boolean;
}

export interface NotificationInput {
  title: string;
  message?: string;
  variant?: NotificationVariant;
  source?: string;
}

export interface NotificationService {
  push(input: NotificationInput): AppNotification;
  markRead(id: string): void;
  markAllRead(): void;
  remove(id: string): void;
  clear(): void;
  getSnapshot(): AppNotification[];
  subscribe(listener: () => void): () => void;
}

export const MAX_NOTIFICATIONS = 50;

export function createNotificationService(): NotificationService {
  let items: AppNotification[] = [];
  const listeners = new Set<() => void>();
  let sequence = 0;

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const nextId = () => {
    sequence += 1;
    return `notif-${Date.now().toString(36)}-${sequence}`;
  };

  return {
    push(input) {
      const item: AppNotification = {
        id: nextId(),
        title: input.title,
        message: input.message,
        variant: input.variant ?? 'info',
        source: input.source,
        createdAt: Date.now(),
        read: false,
      };
      items = [item, ...items].slice(0, MAX_NOTIFICATIONS);
      notify();
      return item;
    },
    markRead(id) {
      const target = items.find((item) => item.id === id);
      if (!target || target.read) {
        return;
      }
      items = items.map((item) => (item.id === id ? { ...item, read: true } : item));
      notify();
    },
    markAllRead() {
      if (items.every((item) => item.read)) {
        return;
      }
      items = items.map((item) => (item.read ? item : { ...item, read: true }));
      notify();
    },
    remove(id) {
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) {
        return;
      }
      items = next;
      notify();
    },
    clear() {
      if (items.length === 0) {
        return;
      }
      items = [];
      notify();
    },
    getSnapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
