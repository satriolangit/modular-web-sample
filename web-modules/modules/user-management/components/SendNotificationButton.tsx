import { useNotifications, useTranslation } from '@arsi/container';
import { Button } from '@arsi/shared';

import type { User } from '../types';

export interface SendNotificationButtonProps {
  user: User;
}

export function SendNotificationButton({ user }: SendNotificationButtonProps) {
  const { t } = useTranslation('user-management');
  const { push } = useNotifications();

  const handleClick = () => {
    push({
      title: t('notifications.sample.title', {
        name: `${user.firstName} ${user.lastName}`,
      }),
      message: t('notifications.sample.message'),
      variant: 'info',
      source: 'user-management',
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      {t('notifications.sample.action')}
    </Button>
  );
}
