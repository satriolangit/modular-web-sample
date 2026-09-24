import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useSlot: () => undefined,
}));

import { UserTable } from './UserTable';
import type { User } from '../types';

const users: User[] = [
  { id: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'admin' },
];

describe('UserTable', () => {
  it('renders user rows', () => {
    render(<UserTable users={users} />);

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('renders the empty message when there are no users', () => {
    render(<UserTable users={[]} />);

    expect(screen.getByText('empty')).toBeInTheDocument();
  });
});
