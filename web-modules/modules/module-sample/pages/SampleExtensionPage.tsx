import { useApiRegistry, useSlot, useTranslation } from '@arsi/container';
import { Badge, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { useSampleUser } from '../hooks/useSample';
import { sampleSlots } from '../slots';

export function SampleExtensionPage() {
  const { t } = useTranslation('module-sample');
  const apiRegistry = useApiRegistry();
  const Panel = useSlot<{ label?: string }>(sampleSlots.overviewPanel);
  const { data: user } = useSampleUser(1);

  const baseUrl = String(apiRegistry.get('module-sample').defaults.baseURL ?? '-');

  return (
    <SamplePageShell titleKey="extension.title" descriptionKey="extension.description">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <Badge variant="success">{t('extension.tiers.slot.title')}</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('extension.tiers.slot.description')}
          </p>
        </Card>
        <Card className="p-4">
          <Badge variant="info">{t('extension.tiers.route.title')}</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('extension.tiers.route.description')}
          </p>
        </Card>
        <Card className="p-4">
          <Badge variant="warning">{t('extension.tiers.service.title')}</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('extension.tiers.service.description')}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">
            {t('extension.slotTitle', { name: sampleSlots.overviewPanel })}
          </h2>
          <Badge variant={Panel ? 'success' : 'secondary'}>
            {Panel ? t('extension.slotFilled') : t('extension.slotEmpty')}
          </Badge>
        </div>
        <div className="mt-3">
          {Panel ? <Panel /> : <p className="text-sm text-muted-foreground">{t('slots.howTo')}</p>}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">{t('extension.serviceTitle')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('extension.serviceBase', { baseUrl })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('extension.serviceResult', {
            name: user ? `${user.firstName} ${user.lastName}` : '-',
          })}
        </p>
      </Card>
    </SamplePageShell>
  );
}
