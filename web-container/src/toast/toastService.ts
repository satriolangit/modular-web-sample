import type { ReactElement } from 'react';
import { toast as sonnerToast } from 'sonner';

export interface ToastService {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
  custom(element: ReactElement): void;
}

export function createToastService(): ToastService {
  return {
    success: (message) => {
      sonnerToast.success(message);
    },
    error: (message) => {
      sonnerToast.error(message);
    },
    info: (message) => {
      sonnerToast.info(message);
    },
    custom: (element) => {
      sonnerToast.custom(() => element);
    },
  };
}
