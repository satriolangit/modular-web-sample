import { useTranslation } from '@arsi/container';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@arsi/shared';

import { useDeleteProduct } from '../hooks/useProduct';
import type { ProductDeletePayload } from '../types';

export interface ProductDeleteDialogProps {
  payload: ProductDeletePayload;
  close: () => void;
}

export function ProductDeleteDialog({ payload, close }: ProductDeleteDialogProps) {
  const { t } = useTranslation('product-management');
  const deleteProduct = useDeleteProduct();

  const handleConfirm = () => {
    deleteProduct.mutate(payload.id, {
      onSuccess: () => {
        payload.onDeleted?.();
        close();
      },
    });
  };

  return (
    <AlertDialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.description', { title: payload.title })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteProduct.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirm}
          >
            {t('actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
