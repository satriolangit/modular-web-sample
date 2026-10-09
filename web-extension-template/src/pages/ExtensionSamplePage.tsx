import { useConfig, useTranslation } from '@arsi/container';
import { Badge, Card, PageHeader } from '@arsi/shared';

export function ExtensionSamplePage() {
  const { client } = useConfig();
  const { t } = useTranslation(client);

  return (
    <div>
      <PageHeader title={t('sample.title')} description={t('sample.description')} />
      <Card className="p-4">
        <Badge variant="info">{t('sample.badge')}</Badge>
        <p className="mt-2 text-sm text-muted-foreground">{t('sample.note')}</p>
      </Card>
    </div>
  );
}
