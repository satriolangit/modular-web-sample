import type { ComponentType } from 'react';

import { useDeps } from '../di/DepsContext';

export function useSlot<TProps = Record<string, unknown>>(
  name: string,
): ComponentType<TProps> | undefined {
  const { slots } = useDeps();
  return slots.get<TProps>(name);
}
