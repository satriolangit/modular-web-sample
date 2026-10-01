import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  isDev: false,
  containerEvents: { searchChanged: 'container.search.changed' },
  useTranslation: () => ({ t: (key: string) => key }),
  useSlot: () => undefined,
  useModal: () => ({ open: vi.fn(), close: vi.fn() }),
  useApiRegistry: () => ({ get: vi.fn() }),
  useApi: () => ({ get: vi.fn(), post: vi.fn() }),
  useEventBus: () => ({ emit: vi.fn(), on: vi.fn(() => () => {}) }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), custom: vi.fn() }),
  useNotifications: () => ({ push: vi.fn(), unreadCount: 0 }),
  useConfig: () => ({ client: 'test', apiBase: '', featureFlags: {} }),
  useAuth: () => ({ user: null, isAuthenticated: false }),
  useTheme: () => ({ theme: 'light' }),
  useLocale: () => ({ locale: 'en' }),
}));

import * as modulePublic from './public';

describe('module-sample public API', () => {
  it('exposes the contract consumed by extensions', () => {
    expect(modulePublic.sampleSlots.overviewPanel).toBe('module-sample.overviewPanel');
    expect(modulePublic.sampleModals.info).toBe('module-sample.info');
    expect(modulePublic.sampleEvents.postCreated).toBe('module-sample.sample.postCreated');
    expect(modulePublic.sampleKeys.all).toEqual(['module-sample', 'sample']);
    expect(typeof modulePublic.createSampleService).toBe('function');
    expect(typeof modulePublic.useSampleUser).toBe('function');
    expect(typeof modulePublic.useSamplePosts).toBe('function');
    expect(typeof modulePublic.useCreateSamplePost).toBe('function');
    expect(typeof modulePublic.useSampleStore).toBe('function');
    expect(typeof modulePublic.SampleOverviewPage).toBe('function');
    expect(typeof modulePublic.SampleNav).toBe('function');
  });
});
