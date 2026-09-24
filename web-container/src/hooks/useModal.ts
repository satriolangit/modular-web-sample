import { useDeps } from '../di/DepsContext';
import type { ModalService } from '../modal/modalService';

export function useModal(): ModalService {
  return useDeps().modal;
}
