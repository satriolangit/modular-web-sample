import { useDeps } from '../di/DepsContext';
import type { EventBus } from '../events/eventBus';

export function useEventBus(): EventBus {
  return useDeps().events;
}
