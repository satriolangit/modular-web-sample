import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  useLocale: () => ({ locale: 'en' }),
  useSlot: () => undefined,
}));

import { ProductTable } from './ProductTable';
import type { ProductListItem } from '../types';

const products: ProductListItem[] = [
  {
    id: 1,
    title: 'Essence Mascara Lash Princess',
    category: 'beauty',
    price: 9.99,
    discountPercentage: 7.17,
    rating: 4.94,
    stock: 5,
    brand: 'Essence',
    thumbnail: 'https://cdn.dummyjson.com/product-images/1/thumbnail.jpg',
  },
];

describe('ProductTable', () => {
  it('renders product rows with formatted price and stock', () => {
    render(<ProductTable products={products} />);

    expect(screen.getByText('Essence Mascara Lash Princess')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('stock.inStock')).toBeInTheDocument();
    expect(screen.getByText('beauty')).toBeInTheDocument();
  });

  it('renders the empty message when there are no products', () => {
    render(<ProductTable products={[]} />);

    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('calls the row action handlers', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ProductTable
        products={products}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    screen.getByRole('button', { name: 'actions.view' }).click();
    screen.getByRole('button', { name: 'actions.edit' }).click();
    screen.getByRole('button', { name: 'actions.delete' }).click();

    expect(onView).toHaveBeenCalledWith(products[0]);
    expect(onEdit).toHaveBeenCalledWith(products[0]);
    expect(onDelete).toHaveBeenCalledWith(products[0]);
  });
});
