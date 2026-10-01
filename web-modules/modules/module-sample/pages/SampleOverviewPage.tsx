import { useAuth, useConfig, useLocale, useSlot, useTheme, useTranslation } from '@arsi/container';
import { Badge, Card, PageHeader } from '@arsi/shared';

import { SampleNav } from '../components/SampleNav';
import { sampleSlots } from '../slots';

export function SampleOverviewPage() {
  const { t } = useTranslation('module-sample');
  const config = useConfig();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { locale } = useLocale();
  const OverviewPanel = useSlot<{ label?: string }>(sampleSlots.overviewPanel);

  const featureFlags = Object.entries(config.featureFlags ?? {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');

  const rows = [
    { label: t('overview.client'), value: config.client },
    { label: t('overview.apiBase'), value: config.apiBase || '-' },
    { label: t('overview.featureFlags'), value: featureFlags || '-' },
    { label: t('overview.user'), value: user?.displayName ?? '-' },
    { label: t('overview.theme'), value: theme },
    { label: t('overview.locale'), value: locale },
  ];

  return (
    <div>
      <PageHeader title={t('title')} description={t('overview.description')} />
      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="text-sm font-semibold">{t('overview.runtimeTitle')}</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="mt-0.5">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold">{t('overview.samplesTitle')}</h2>
          <SampleNav />
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">
              {t('overview.slotTitle', { name: sampleSlots.overviewPanel })}
            </h2>
            <Badge variant={OverviewPanel ? 'success' : 'secondary'}>
              {OverviewPanel ? t('slots.filled') : t('slots.empty')}
            </Badge>
          </div>
          <div className="mt-3">
            {OverviewPanel ? (
              <OverviewPanel />
            ) : (
              <p className="text-sm text-muted-foreground">{t('overview.slotEmpty')}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
