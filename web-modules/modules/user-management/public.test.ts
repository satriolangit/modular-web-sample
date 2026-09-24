import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  isDev: false,
  useTranslation: () => ({ t: (key: string) => key }),
  useSlot: () => undefined,
  useModal: () => ({ open: vi.fn(), close: vi.fn() }),
  useApiRegistry: () => ({ get: vi.fn() }),
  useEventBus: () => ({ emit: vi.fn(), on: vi.fn() }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import * as modulePublic from './public';

describe('user-management public API', () => {
  it('exposes the contract consumed by extensions', () => {
    expect(modulePublic.userSlots.userTableActions).toBe('user-management.userTableActions');
    expect(modulePublic.userSlots.userDetailSidebar).toBe(
      'user-management.userDetailSidebar',
    );
    expect(modulePublic.userModals.create).toBe('user-management.create');
    expect(modulePublic.userEvents.updated).toBe('user-management.user.updated');
    expect(modulePublic.userKeys.all).toEqual(['user-management', 'user']);
    expect(typeof modulePublic.createUserService).toBe('function');
    expect(typeof modulePublic.useUserList).toBe('function');
    expect(typeof modulePublic.useUser).toBe('function');
    expect(typeof modulePublic.useCreateUser).toBe('function');
    expect(typeof modulePublic.UserTable).toBe('function');
    expect(typeof modulePublic.UserListPage).toBe('function');
    expect(typeof modulePublic.useUserStore).toBe('function');
  });
});
