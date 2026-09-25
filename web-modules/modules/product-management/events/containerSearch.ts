import { containerEvents, type ContainerSearchPayload, type EventBus } from '@arsi/container';

import { useProductStore } from '../store/useProductStore';

export function registerContainerSearchListener(events: EventBus): () => void {
  return events.on<ContainerSearchPayload>(containerEvents.searchChanged, ({ query }) => {
    useProductStore.getState().setSearch(query);
  });
}
