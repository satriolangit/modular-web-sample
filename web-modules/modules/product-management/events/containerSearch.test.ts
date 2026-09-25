import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arsi/container')>();
  return { ...actual, isDev: false };
});

import { containerEvents, type EventBus } from '@arsi/container';

import { useProductStore } from '../store/useProductStore';
import { registerContainerSearchListener } from './containerSearch';

function createFakeBus() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();

  const bus = {
    on: (event: string, handler: (payload: unknown) => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
      return () => {
        set.delete(handler);
      };
    },
    off: () => undefined,
    emit: (event: string, payload?: unknown) => {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
    clear: () => handlers.clear(),
  } as unknown as EventBus;

  return { bus, registeredEvents: () => [...handlers.keys()] };
}

describe('registerContainerSearchListener', () => {
  beforeEach(() => {
    localStorage.clear();
    useProductStore.setState({
      search: '',
      category: null,
      sort: 'default',
      page: 1,
      pageSize: 10,
    });
  });

  it('applies the container search query to the product store', () => {
    const { bus, registeredEvents } = createFakeBus();
    registerContainerSearchListener(bus);

    expect(registeredEvents()).toEqual([containerEvents.searchChanged]);

    useProductStore.getState().setPage(3);
    bus.emit(containerEvents.searchChanged, { query: 'phone' });

    expect(useProductStore.getState().search).toBe('phone');
    expect(useProductStore.getState().page).toBe(1);
  });

  it('stops listening after unsubscribe', () => {
    const { bus } = createFakeBus();
    const unsubscribe = registerContainerSearchListener(bus);
    unsubscribe();

    bus.emit(containerEvents.searchChanged, { query: 'phone' });

    expect(useProductStore.getState().search).toBe('');
  });
});
