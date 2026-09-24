import { Link, useNavigate, useParams } from 'react-router-dom';
import { useModal, useSlot, useTranslation } from '@arsi/container';
import { Button, ErrorState, Skeleton } from '@arsi/shared';

import { ProductDetailCard } from '../components/ProductDetailCard';
import { useProduct } from '../hooks/useProduct';
import { productModals } from '../modals';
import { productSlots } from '../slots';
import type { Product } from '../types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('product-management');
  const navigate = useNavigate();
  const modal = useModal();
  const { data: product, isLoading, isError, refetch } = useProduct(id);
  const DetailSidebar = useSlot<{ product: Product }>(productSlots.productDetailSidebar);

  const handleDelete = () => {
    if (!product) {
      return;
    }
    modal.open(productModals.deleteConfirm, {
      id: product.id,
      title: product.title,
      onDeleted: () => navigate('/products'),
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/products">{t('actions.back')}</Link>
        </Button>
        {product ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/products/${product.id}/edit`)}
            >
              {t('actions.edit')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              {t('actions.delete')}
            </Button>
          </div>
        ) : null}
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : null}
      {isError ? (
        <ErrorState
          title={t('detail.errorTitle')}
          description={t('detail.errorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}
      {product ? (
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <ProductDetailCard product={product} />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('detail.sidebarTitle')}
            </h2>
            {DetailSidebar ? (
              <DetailSidebar product={product} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('detail.sidebarEmpty')}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
