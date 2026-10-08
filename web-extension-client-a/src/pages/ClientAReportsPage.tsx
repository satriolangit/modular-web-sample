import { useTranslation } from '@arsi/container';
import { Badge, Card, PageHeader } from '@arsi/shared';

export function ClientAReportsPage() {
  const { t } = useTranslation('client-a');

  return (
    <div>
      <PageHeader title={t('reports.title')} description={t('reports.description')} />
      <Card className="p-4">
        <Badge variant="info">{t('reports.badge')}</Badge>
        <p className="mt-2 text-sm text-muted-foreground">{t('reports.note')}</p>
      </Card>
    </div>
  );
}
