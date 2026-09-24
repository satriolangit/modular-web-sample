import { useLocale, useTranslation } from '@arsi/container';
import { Badge, Card, Rating } from '@arsi/shared';

import { formatPrice } from '../lib/format';
import type { Product } from '../types';

export interface ProductDetailCardProps {
  product: Product;
}

export function ProductDetailCard({ product }: ProductDetailCardProps) {
  const { t } = useTranslation('product-management');
  const { locale } = useLocale();

  const originalPrice =
    product.discountPercentage > 0
      ? product.price / (1 - product.discountPercentage / 100)
      : product.price;

  const rows = [
    { label: t('detail.fields.brand'), value: product.brand ?? '-' },
    { label: t('detail.fields.sku'), value: product.sku },
    { label: t('detail.fields.category'), value: product.category },
    { label: t('detail.fields.stock'), value: String(product.stock) },
    { label: t('detail.fields.availability'), value: product.availabilityStatus },
    { label: t('detail.fields.weight'), value: String(product.weight) },
    { label: t('detail.fields.warranty'), value: product.warrantyInformation },
    { label: t('detail.fields.shipping'), value: product.shippingInformation },
    { label: t('detail.fields.returnPolicy'), value: product.returnPolicy },
    { label: t('detail.fields.minOrder'), value: String(product.minimumOrderQuantity) },
  ];

  return (
    <Card className="p-6">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="space-y-3">
          <img
            src={product.thumbnail}
            alt={product.title}
            className="aspect-square w-full rounded-md border object-cover"
          />
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(0, 4).map((image) => (
                <img
                  key={image}
                  src={image}
                  alt=""
                  className="aspect-square w-full rounded border object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{product.title}</h2>
              <Badge variant="outline">{product.category}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-2xl font-semibold">
                {formatPrice(product.price, locale)}
              </span>
              {product.discountPercentage > 0 ? (
                <>
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(originalPrice, locale)}
                  </span>
                  <Badge variant="destructive">
                    -{product.discountPercentage.toFixed(0)}%
                  </Badge>
                </>
              ) : null}
              <Rating value={product.rating} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{product.description}</p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-sm">{row.value}</dd>
              </div>
            ))}
          </dl>
          {product.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
