import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ProductForm } from './ProductForm';
import type { ProductCategory } from '../types';

const categories: ProductCategory[] = [
  { slug: 'beauty', name: 'Beauty', url: '' },
  { slug: 'furniture', name: 'Furniture', url: '' },
];

describe('ProductForm', () => {
  it('shows i18n validation messages when submitting an empty form', async () => {
    render(
      <ProductForm mode="create" categories={categories} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'actions.create' }));

    expect(await screen.findByText('form.errors.titleMin')).toBeInTheDocument();
    expect(await screen.findByText('form.errors.descriptionMin')).toBeInTheDocument();
    expect(await screen.findByText('form.errors.categoryRequired')).toBeInTheDocument();
    expect(await screen.findByText('form.errors.priceRequired')).toBeInTheDocument();
    expect(await screen.findByText('form.errors.stockRequired')).toBeInTheDocument();
  });

  it('submits coerced values when the input is valid', async () => {
    const onSubmit = vi.fn();

    render(
      <ProductForm
        mode="edit"
        categories={categories}
        initialValues={{
          title: 'Wireless Headphones',
          description: 'Great sound quality and comfort.',
          category: 'beauty',
          brand: 'Acme',
          price: '99.99',
          stock: '12',
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Wireless Headphones',
      description: 'Great sound quality and comfort.',
      category: 'beauty',
      brand: 'Acme',
      price: 99.99,
      stock: 12,
    });
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();

    render(
      <ProductForm mode="create" categories={categories} onSubmit={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
