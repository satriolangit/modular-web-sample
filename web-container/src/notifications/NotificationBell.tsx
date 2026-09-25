import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';

import { useNotifications } from '../hooks/useNotifications';
import type { NotificationVariant } from './notificationService';

const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const defaultTriggerClassName = `relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-card shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground ${focusRingClassName}`;

const iconButtonClassName = `inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${focusRingClassName}`;

const variantDotClassName: Record<NotificationVariant, string> = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
};

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { notifications, unreadCount, markRead, markAllRead, remove, clear } =
    useNotifications();

  const triggerLabel =
    unreadCount > 0
      ? t('notifications.openWithCount', { count: unreadCount })
      : t('actions.openNotifications');

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={className ?? defaultTriggerClassName}
          aria-label={triggerLabel}
        >
          <BellIcon />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-lg border bg-popover text-popover-foreground shadow-soft-md outline-none"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className={`rounded-sm text-xs font-medium text-primary transition-colors hover:text-primary-hover ${focusRingClassName}`}
              >
                {t('notifications.markAllRead')}
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`flex gap-3 border-b px-4 py-3 last:border-b-0 ${
                    item.read ? '' : 'bg-accent/40'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${variantDotClassName[item.variant]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.message ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.message}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.source ? <span>{item.source} · </span> : null}
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.read ? null : (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        aria-label={t('notifications.markRead')}
                        className={iconButtonClassName}
                      >
                        <CheckIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      aria-label={t('notifications.remove')}
                      className={iconButtonClassName}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {notifications.length > 0 ? (
            <div className="border-t px-4 py-2">
              <button
                type="button"
                onClick={clear}
                className={`w-full rounded-sm py-1 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground ${focusRingClassName}`}
              >
                {t('notifications.clearAll')}
              </button>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
