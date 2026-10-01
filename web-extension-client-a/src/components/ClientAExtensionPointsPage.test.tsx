import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const { useClientASampleUserMock } = vi.hoisted(() => ({
  useClientASampleUserMock: vi.fn(),
}));

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks/useClientASample', () => ({
  useClientASampleUser: useClientASampleUserMock,
}));

import { ClientAExtensionPointsPage } from './ClientAExtensionPointsPage';

describe('ClientAExtensionPointsPage', () => {
  it('renders the overridden page with wrapped service data', () => {
    useClientASampleUserMock.mockReturnValue({
      data: { id: 1, firstName: 'Ada', lastName: 'Lovelace (client-a)', email: 'ada@example.com' },
      isFetching: false,
      isError: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <ClientAExtensionPointsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('sample.pageTitle')).toBeTruthy();
    expect(screen.getByText('sample.routeBadge')).toBeTruthy();
    expect(screen.getByText(/Lovelace \(client-a\)/)).toBeTruthy();
  });
});
