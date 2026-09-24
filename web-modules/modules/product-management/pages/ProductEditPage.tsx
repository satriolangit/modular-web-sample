import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from '@arsi/container';
import { Card, ErrorState, PageHeader, Skeleton } from '@arsi/shared';

import { ProductForm } from '../components/ProductForm';
import { useProduct, useProductCategories, useUpdateProduct } from '../hooks/useProduct';
import type { ProductFormInput } from '../schemas/productSchema';

export function ProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('product-management');
  const navigate = useNavigate();
  const { data: product, isLoading, isError, refetch } = useProduct(id);
  const { data: categories } = useProductCategories();
  const updateProduct = useUpdateProduct();

  const initialValues = useMemo<ProductFormInput | undefined>(() => {
    if (!product) {
      return undefined;
    }
    return {
      title: product.title,
      description: product.description,
      category: product.category,
      brand: product.brand ?? '',
      price: String(product.price),
      stock: String(product.stock),
    };
  }, [product]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('form.editTitle')} description={t('form.editDescription')} />
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
      {initialValues ? (
        <Card className="p-6">
          <ProductForm
            mode="edit"
            initialValues={initialValues}
            categories={categories ?? []}
            isSubmitting={updateProduct.isPending}
            onCancel={() => navigate(`/products/${id}`)}
            onSubmit={(values) => {
              updateProduct.mutate(
                { id: Number(id), changes: values },
                { onSuccess: () => navigate(`/products/${id}`) },
              );
            }}
          />
        </Card>
      ) : null}
    </div>
  );
}
