import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './eventBus';

describe('createEventBus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('user-management.user.updated', handler);
    bus.emit('user-management.user.updated', { id: 1 });

    expect(handler).toHaveBeenCalledWith({ id: 1 });
  });

  it('supports unsubscribing via the returned function', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on('event', handler);
    unsubscribe();
    bus.emit('event', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers to multiple subscribers and supports off()', () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();

    bus.on('event', first);
    bus.on('event', second);
    bus.off('event', first);
    bus.emit('event', 'payload');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('payload');
  });

  it('does not fail when emitting an event without listeners', () => {
    const bus = createEventBus();

    expect(() => bus.emit('nobody.listens', {})).not.toThrow();
  });

  it('clears all listeners', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on('event', handler);
    bus.clear();
    bus.emit('event');

    expect(handler).not.toHaveBeenCalled();
  });
});
