import { useTranslation } from '@arsi/container';
import { Badge, Card } from '@arsi/shared';

export function ClientASamplePanel() {
  const { t } = useTranslation('client-a');

  return (
    <Card className="border-primary/30 bg-accent/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t('sample.panelBadge')}</Badge>
        <h3 className="text-sm font-semibold">{t('sample.panelTitle')}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('sample.panelDescription')}</p>
    </Card>
  );
}
