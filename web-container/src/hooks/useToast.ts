import { useDeps } from '../di/DepsContext';
import type { ToastService } from '../toast/toastService';

export function useToast(): ToastService {
  return useDeps().toast;
}
