import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
  useNotifications: () => ({ push: pushMock }),
}));

import { SendNotificationButton } from './SendNotificationButton';
import type { User } from '../types';

const user: User = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
};

describe('SendNotificationButton', () => {
  it('pushes a notification sourced from the module', () => {
    render(<SendNotificationButton user={user} />);

    screen.getByRole('button').click();

    expect(pushMock).toHaveBeenCalledWith({
      title: expect.stringContaining('notifications.sample.title'),
      message: 'notifications.sample.message',
      variant: 'info',
      source: 'user-management',
    });
  });
});
