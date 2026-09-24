import type { AppConfig } from '../config/types';
import { useDeps } from '../di/DepsContext';

export function useConfig(): AppConfig {
  return useDeps().config;
}
