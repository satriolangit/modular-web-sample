import type { AxiosInstance } from 'axios';

import { useDeps } from '../di/DepsContext';

export function useApi(): AxiosInstance {
  return useDeps().api;
}
