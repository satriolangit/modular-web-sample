import { useSlot, useTranslation } from '@arsi/container';
import { Badge, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { sampleSlots } from '../slots';

export function SampleSlotsPage() {
  const { t } = useTranslation('module-sample');
  const Panel = useSlot<{ label?: string }>(sampleSlots.overviewPanel);

  return (
    <SamplePageShell titleKey="slots.title" descriptionKey="slots.description">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t('slots.name')}:</span>
          <code className="rounded bg-muted px-2 py-0.5 text-xs">
            {sampleSlots.overviewPanel}
          </code>
          <Badge variant={Panel ? 'success' : 'secondary'}>
            {Panel ? t('slots.filled') : t('slots.empty')}
          </Badge>
        </div>

        <div className="mt-4">
          {Panel ? <Panel /> : <p className="text-sm text-muted-foreground">{t('slots.howTo')}</p>}
        </div>
      </Card>
    </SamplePageShell>
  );
}
