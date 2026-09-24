import { describe, expect, it } from 'vitest';

import { createSlotRegistry } from './slotRegistry';

function FakeActions() {
  return null;
}

describe('createSlotRegistry', () => {
  it('registers and retrieves slot components', () => {
    const registry = createSlotRegistry();

    registry.register('user-management.userTableActions', FakeActions);

    expect(registry.has('user-management.userTableActions')).toBe(true);
    expect(registry.get('user-management.userTableActions')).toBe(FakeActions);
  });

  it('returns undefined for unknown slots', () => {
    const registry = createSlotRegistry();

    expect(registry.get('unknown.slot')).toBeUndefined();
  });

  it('throws when a slot is filled twice', () => {
    const registry = createSlotRegistry();
    registry.register('user-management.userTableActions', FakeActions);

    expect(() =>
      registry.register('user-management.userTableActions', FakeActions),
    ).toThrow(/already has a component/);
  });
});
