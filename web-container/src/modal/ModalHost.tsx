import { useSyncExternalStore } from 'react';

import { useDeps } from '../di/DepsContext';

export function ModalHost() {
  const { modal } = useDeps();
  const active = useSyncExternalStore(modal.subscribe, modal.getSnapshot);

  if (!active) {
    return null;
  }

  const Component = modal.getComponent(active.name);
  if (!Component) {
    return null;
  }

  const close = () => {
    modal.close(active.name);
  };

  return <Component payload={active.payload} close={close} />;
}
