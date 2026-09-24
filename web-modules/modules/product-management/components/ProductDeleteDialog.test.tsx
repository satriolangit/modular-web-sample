import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));

vi.mock('../hooks/useProduct', () => ({
  useDeleteProduct: () => ({ mutate: mutateMock, isPending: false }),
}));

import { ProductDeleteDialog } from './ProductDeleteDialog';

describe('ProductDeleteDialog', () => {
  it('deletes the product and closes on confirm', () => {
    const close = vi.fn();
    mutateMock.mockImplementation((_id: number, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    render(
      <ProductDeleteDialog payload={{ id: 7, title: 'Essence Mascara' }} close={close} />,
    );

    expect(screen.getByText('delete.title')).toBeInTheDocument();
    expect(screen.getByText('delete.description')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));

    expect(mutateMock).toHaveBeenCalledWith(7, expect.objectContaining({ onSuccess: expect.any(Function) }));
    expect(close).toHaveBeenCalled();
  });

  it('calls the onDeleted callback after a successful delete', () => {
    const close = vi.fn();
    const onDeleted = vi.fn();
    mutateMock.mockImplementation((_id: number, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });

    render(
      <ProductDeleteDialog
        payload={{ id: 7, title: 'Essence Mascara', onDeleted }}
        close={close}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));

    expect(onDeleted).toHaveBeenCalledTimes(1);
  });
});
