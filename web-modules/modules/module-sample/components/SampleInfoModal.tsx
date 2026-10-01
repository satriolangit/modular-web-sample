import { useTranslation } from '@arsi/container';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@arsi/shared';

import type { SampleInfoModalPayload } from '../modals';

export interface SampleInfoModalProps {
  payload: SampleInfoModalPayload;
  close: () => void;
}

export function SampleInfoModal({ payload, close }: SampleInfoModalProps) {
  const { t } = useTranslation('module-sample');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('modal.modalTitle')}</DialogTitle>
          <DialogDescription>
            {t('modal.modalMessage', { payload: payload.message })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('modal.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
