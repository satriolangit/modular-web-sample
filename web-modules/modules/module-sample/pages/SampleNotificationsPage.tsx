import { useNotifications, useTranslation } from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import type { NotificationVariant } from '@arsi/container';

export function SampleNotificationsPage() {
  const { t } = useTranslation('module-sample');
  const { push, unreadCount } = useNotifications();

  const send = (variant: NotificationVariant, key: string) => {
    push({
      title: t(`notifications.${key}`),
      message: t('notifications.pushed'),
      variant,
      source: 'module-sample',
    });
  };

  return (
    <SamplePageShell titleKey="notifications.title" descriptionKey="notifications.description">
      <Card className="p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          {t('notifications.unread', { count: unreadCount })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => send('info', 'info')}>
            {t('notifications.info')}
          </Button>
          <Button variant="outline" onClick={() => send('success', 'success')}>
            {t('notifications.success')}
          </Button>
          <Button variant="outline" onClick={() => send('warning', 'warning')}>
            {t('notifications.warning')}
          </Button>
          <Button variant="outline" onClick={() => send('error', 'error')}>
            {t('notifications.error')}
          </Button>
        </div>
      </Card>
    </SamplePageShell>
  );
}
