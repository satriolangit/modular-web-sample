import { useDeps } from '../di/DepsContext';
import type { Logger } from '../logger/logger';

export function useLogger(): Logger {
  return useDeps().logger;
}
