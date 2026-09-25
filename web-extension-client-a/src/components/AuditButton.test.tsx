import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { emitMock, pushMock, infoMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  pushMock: vi.fn(),
  infoMock: vi.fn(),
}));

vi.mock('@arsi/container', () => ({
  useConfig: () => ({ featureFlags: { enableAuditLive: true } }),
  useEventBus: () => ({ emit: emitMock }),
  useNotifications: () => ({ push: pushMock }),
  useToast: () => ({ info: infoMock }),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AuditButton } from './AuditButton';
import type { User } from '@arsi/module-user-management';

const user: User = {
  id: 7,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
};

describe('AuditButton', () => {
  it('emits the audit event and pushes a client notification', () => {
    render(<AuditButton user={user} />);

    screen.getByRole('button').click();

    expect(emitMock).toHaveBeenCalledWith('client-a.audit.requested', { userId: 7 });
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'audit.requested',
        variant: 'info',
        source: 'client-a',
      }),
    );
  });
});
