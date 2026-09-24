import type { ApiRegistry } from '../api/apiRegistry';
import { useDeps } from '../di/DepsContext';

export function useApiRegistry(): ApiRegistry {
  return useDeps().apiRegistry;
}
