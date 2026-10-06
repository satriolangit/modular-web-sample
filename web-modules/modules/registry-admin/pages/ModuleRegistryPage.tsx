import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@arsi/shared';
import { useConfig, useTranslation } from '@arsi/container';

export function ModuleRegistryPage() {
  const { t } = useTranslation('registry-admin');
  const config = useConfig();

  if (!config.registryAdminUrl) {
    return <EmptyState title={t('title')} description={t('errors.notConfigured')} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </CardContent>
    </Card>
  );
}
