import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@arsi/container';
import { Card, PageHeader } from '@arsi/shared';

import { ProductForm } from '../components/ProductForm';
import { useCreateProduct, useProductCategories } from '../hooks/useProduct';

export function ProductCreatePage() {
  const { t } = useTranslation('product-management');
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const { data: categories } = useProductCategories();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('form.createTitle')} description={t('form.createDescription')} />
      <Card className="p-6">
        <ProductForm
          mode="create"
          categories={categories ?? []}
          isSubmitting={createProduct.isPending}
          onCancel={() => navigate('/products')}
          onSubmit={(values) => {
            createProduct.mutate(values, {
              onSuccess: (product) => navigate(`/products/${product.id}`),
            });
          }}
        />
      </Card>
    </div>
  );
}
