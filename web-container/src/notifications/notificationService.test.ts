import { describe, expect, it, vi } from 'vitest';

import { MAX_NOTIFICATIONS, createNotificationService } from './notificationService';

const makeService = () => createNotificationService();

describe('notificationService', () => {
  it('pushes newest first with defaults', () => {
    const service = makeService();
    const first = service.push({ title: 'First' });
    service.push({ title: 'Second', variant: 'success', source: 'user-management' });

    const snapshot = service.getSnapshot();
    expect(snapshot[0].title).toBe('Second');
    expect(snapshot[1].title).toBe('First');
    expect(first).toMatchObject({ title: 'First', variant: 'info', read: false });
    expect(snapshot[0].variant).toBe('success');
    expect(snapshot[0].source).toBe('user-management');
    expect(typeof first.createdAt).toBe('number');
    expect(snapshot[0].id).not.toBe(first.id);
  });

  it('caps the list and drops the oldest', () => {
    const service = makeService();
    for (let i = 0; i < MAX_NOTIFICATIONS + 5; i += 1) {
      service.push({ title: `n-${i}` });
    }

    const snapshot = service.getSnapshot();
    expect(snapshot).toHaveLength(MAX_NOTIFICATIONS);
    expect(snapshot[0].title).toBe(`n-${MAX_NOTIFICATIONS + 4}`);
    expect(snapshot.some((item) => item.title === 'n-0')).toBe(false);
  });

  it('keeps the snapshot reference stable until a mutation', () => {
    const service = makeService();
    const before = service.getSnapshot();
    expect(service.getSnapshot()).toBe(before);

    service.push({ title: 'x' });
    expect(service.getSnapshot()).not.toBe(before);
  });

  it('marks a single item read once', () => {
    const service = makeService();
    const listener = vi.fn();
    service.subscribe(listener);
    const item = service.push({ title: 'x' });
    listener.mockClear();

    service.markRead(item.id);
    expect(service.getSnapshot()[0].read).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    service.markRead(item.id);
    expect(listener).toHaveBeenCalledTimes(1);

    service.markRead('missing');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('marks all items read and notifies only when something changes', () => {
    const service = makeService();
    service.push({ title: 'a' });
    service.push({ title: 'b' });
    const listener = vi.fn();
    service.subscribe(listener);

    service.markAllRead();
    expect(service.getSnapshot().every((item) => item.read)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    service.markAllRead();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('removes and clears without notifying on no-ops', () => {
    const service = makeService();
    const item = service.push({ title: 'a' });
    const listener = vi.fn();
    service.subscribe(listener);

    service.remove('missing');
    expect(listener).not.toHaveBeenCalled();

    service.remove(item.id);
    expect(service.getSnapshot()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);

    service.clear();
    expect(listener).toHaveBeenCalledTimes(1);

    service.push({ title: 'b' });
    listener.mockClear();
    service.clear();
    expect(service.getSnapshot()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const service = makeService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    unsubscribe();

    service.push({ title: 'x' });
    expect(listener).not.toHaveBeenCalled();
  });
});
