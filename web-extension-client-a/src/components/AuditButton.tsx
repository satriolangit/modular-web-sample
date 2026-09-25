import {
  useConfig,
  useEventBus,
  useNotifications,
  useToast,
  useTranslation,
} from '@arsi/container';
import { Button } from '@arsi/shared';
import type { User } from '@arsi/module-user-management';

export interface AuditButtonProps {
  user: User;
}

export function AuditButton({ user }: AuditButtonProps) {
  const config = useConfig();
  const events = useEventBus();
  const notifications = useNotifications();
  const toast = useToast();
  const { t } = useTranslation('client-a');

  if (!config.featureFlags?.enableAuditLive) {
    return null;
  }

  const handleClick = () => {
    events.emit('client-a.audit.requested', { userId: user.id });
    notifications.push({
      title: t('audit.requested'),
      message: `${user.firstName} ${user.lastName} (#${user.id})`,
      variant: 'info',
      source: 'client-a',
    });
    toast.info(t('audit.requested'));
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleClick}>
      {t('audit.action')}
    </Button>
  );
}
