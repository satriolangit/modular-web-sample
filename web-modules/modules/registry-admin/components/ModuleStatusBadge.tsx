import { Badge } from '@arsi/shared';
import { useTranslation } from '@arsi/container';

export function ModuleStatusBadge({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation('registry-admin');
  return (
    <Badge variant={enabled ? 'success' : 'secondary'}>
      {t(enabled ? 'table.enabled' : 'table.disabled')}
    </Badge>
  );
}
