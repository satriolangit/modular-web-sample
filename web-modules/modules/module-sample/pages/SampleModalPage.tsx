import { useModal, useTranslation } from '@arsi/container';
import { Button, Card } from '@arsi/shared';

import { SamplePageShell } from '../components/SamplePageShell';
import { sampleModals } from '../modals';

export function SampleModalPage() {
  const { t } = useTranslation('module-sample');
  const modal = useModal();

  return (
    <SamplePageShell titleKey="modal.title" descriptionKey="modal.description">
      <Card className="p-4">
        <Button
          onClick={() =>
            modal.open(sampleModals.info, {
              title: t('modal.modalTitle'),
              message: 'module-sample',
            })
          }
        >
          {t('modal.open')}
        </Button>
      </Card>
    </SamplePageShell>
  );
}
