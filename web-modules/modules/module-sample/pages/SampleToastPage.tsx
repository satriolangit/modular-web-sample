import { useToast, useTranslation } from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';

export function SampleToastPage() {
  const { t } = useTranslation('module-sample');
  const toast = useToast();

  return (
    <SamplePageShell titleKey="toast.title" descriptionKey="toast.description">
      <Card className="flex flex-wrap gap-2 p-4">
        <Button variant="outline" onClick={() => toast.success(t('toast.success'))}>
          {t('toast.success')}
        </Button>
        <Button variant="outline" onClick={() => toast.error(t('toast.error'))}>
          {t('toast.error')}
        </Button>
        <Button variant="outline" onClick={() => toast.info(t('toast.info'))}>
          {t('toast.info')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast.custom(
              <div className="rounded-md border bg-card px-4 py-3 text-sm shadow-soft-md">
                {t('toast.customMessage')}
              </div>,
            )
          }
        >
          {t('toast.custom')}
        </Button>
      </Card>
    </SamplePageShell>
  );
}
