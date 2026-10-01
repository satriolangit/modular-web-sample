import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({ isDev: false }));

import { useSampleStore } from './useSampleStore';

describe('useSampleStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSampleStore.setState({ counter: 0, note: '', showDetails: true });
  });

  it('increments and decrements the counter', () => {
    useSampleStore.getState().increment();
    useSampleStore.getState().increment();
    useSampleStore.getState().decrement();

    expect(useSampleStore.getState().counter).toBe(1);
  });

  it('persists ui state under the module namespace', () => {
    useSampleStore.getState().setNote('hello');

    expect(localStorage.getItem('module:module-sample')).toContain('hello');
  });

  it('toggles details and resets to defaults', () => {
    useSampleStore.getState().toggleDetails();
    expect(useSampleStore.getState().showDetails).toBe(false);

    useSampleStore.getState().increment();
    useSampleStore.getState().setNote('x');
    useSampleStore.getState().reset();

    const state = useSampleStore.getState();
    expect(state.counter).toBe(0);
    expect(state.note).toBe('');
    expect(state.showDetails).toBe(true);
  });
});
