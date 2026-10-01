import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

import { SampleNav } from './SampleNav';

describe('SampleNav', () => {
  it('renders one link per sample page', () => {
    render(
      <MemoryRouter>
        <SampleNav />
      </MemoryRouter>,
    );

    expect(screen.getByText('nav.api')).toBeInTheDocument();
    expect(screen.getByText('nav.logger')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(11);
  });
});
