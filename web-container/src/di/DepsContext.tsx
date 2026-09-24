import { createContext, useContext, type ReactNode } from 'react';

import type { Deps } from './deps';

const DepsContext = createContext<Deps | null>(null);

export function DepsProvider({ deps, children }: { deps: Deps; children: ReactNode }) {
  return <DepsContext.Provider value={deps}>{children}</DepsContext.Provider>;
}

export function useDeps(): Deps {
  const deps = useContext(DepsContext);
  if (!deps) {
    throw new Error('useDeps must be used within a DepsProvider');
  }
  return deps;
}
