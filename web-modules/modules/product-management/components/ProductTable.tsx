import { useLocale, useSlot, useTranslation } from '@arsi/container';
import { Badge, Button, DataTable, Rating, type DataTableColumn } from '@arsi/shared';

import { formatPrice } from '../lib/format';
import { productSlots } from '../slots';
import type { ProductListItem } from '../types';

export interface ProductTableProps {
  products: ProductListItem[];
  isLoading?: boolean;
  onView?: (product: ProductListItem) => void;
  onEdit?: (product: ProductListItem) => void;
  onDelete?: (product: ProductListItem) => void;
}

export function ProductTable({ products, isLoading, onView, onEdit, onDelete }: ProductTableProps) {
  const { t } = useTranslation('product-management');
  const { locale } = useLocale();
  const RowActions = useSlot<{ product: ProductListItem }>(productSlots.productTableActions);

  const columns: DataTableColumn<ProductListItem>[] = [
    {
      key: 'product',
      header: t('columns.product'),
      render: (product) => (
        <div className="flex items-center gap-3">
          <img
            src={product.thumbnail}
            alt=""
            className="h-10 w-10 rounded-md border object-cover"
            loading="lazy"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{product.title}</p>
            <p className="text-xs text-muted-foreground">{product.brand ?? '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('columns.category'),
      render: (product) => <Badge variant="outline">{product.category}</Badge>,
    },
    {
      key: 'price',
      header: t('columns.price'),
      render: (product) => (
        <div>
          <p className="font-medium">{formatPrice(product.price, locale)}</p>
          {product.discountPercentage > 0 ? (
            <p className="text-xs text-muted-foreground">
              -{product.discountPercentage.toFixed(0)}%
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'stock',
      header: t('columns.stock'),
      render: (product) => (
        <Badge variant={product.stock > 0 ? 'secondary' : 'destructive'}>
          {product.stock > 0 ? t('stock.inStock', { count: product.stock }) : t('stock.outOfStock')}
        </Badge>
      ),
    },
    {
      key: 'rating',
      header: t('columns.rating'),
      render: (product) => <Rating value={product.rating} />,
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      className: 'text-right',
      render: (product) => (
        <div className="flex justify-end gap-2">
          {onView ? (
            <Button variant="outline" size="sm" onClick={() => onView(product)}>
              {t('actions.view')}
            </Button>
          ) : null}
          {onEdit ? (
            <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
              {t('actions.edit')}
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="destructive" size="sm" onClick={() => onDelete(product)}>
              {t('actions.delete')}
            </Button>
          ) : null}
          {RowActions ? <RowActions product={product} /> : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      rowKey={(product) => product.id}
      isLoading={isLoading}
      emptyMessage={t('empty')}
    />
  );
}
