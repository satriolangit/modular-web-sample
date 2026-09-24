import { useNavigate } from 'react-router-dom';
import { useModal, useTranslation } from '@arsi/container';
import {
  Button,
  DataTablePagination,
  ErrorState,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useDebouncedValue,
} from '@arsi/shared';

import { ProductTable } from '../components/ProductTable';
import { useProductCategories, useProductList } from '../hooks/useProduct';
import { productModals } from '../modals';
import { PRODUCT_SORT_QUERIES } from '../services/service.product';
import { useProductStore } from '../store/useProductStore';
import type { ProductListItem, ProductSortKey } from '../types';

const SORT_OPTIONS: Array<{ value: ProductSortKey; labelKey: string }> = [
  { value: 'default', labelKey: 'sort.default' },
  { value: 'title-asc', labelKey: 'sort.titleAsc' },
  { value: 'price-asc', labelKey: 'sort.priceAsc' },
  { value: 'price-desc', labelKey: 'sort.priceDesc' },
  { value: 'rating-desc', labelKey: 'sort.ratingDesc' },
];

export function ProductListPage() {
  const { t } = useTranslation('product-management');
  const navigate = useNavigate();
  const modal = useModal();

  const search = useProductStore((state) => state.search);
  const category = useProductStore((state) => state.category);
  const sort = useProductStore((state) => state.sort);
  const page = useProductStore((state) => state.page);
  const pageSize = useProductStore((state) => state.pageSize);
  const setSearch = useProductStore((state) => state.setSearch);
  const setCategory = useProductStore((state) => state.setCategory);
  const setSort = useProductStore((state) => state.setSort);
  const setPage = useProductStore((state) => state.setPage);
  const resetFilters = useProductStore((state) => state.resetFilters);

  const debouncedSearch = useDebouncedValue(search, 300);
  const sortQuery = PRODUCT_SORT_QUERIES[sort];

  const { data, isLoading, isError, refetch } = useProductList({
    limit: pageSize,
    skip: (page - 1) * pageSize,
    search: debouncedSearch || undefined,
    category: debouncedSearch ? undefined : (category ?? undefined),
    ...sortQuery,
  });
  const { data: categories } = useProductCategories();

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = Boolean(search) || Boolean(category) || sort !== 'default';

  const handleDelete = (product: ProductListItem) => {
    modal.open(productModals.deleteConfirm, { id: product.id, title: product.title });
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('list.description')}
        actions={
          <Button onClick={() => navigate('/products/new')}>{t('actions.create')}</Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search.placeholder')}
          />
        </div>
        <Select
          value={category ?? 'all'}
          onValueChange={(value) => setCategory(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filters.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {categories?.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as ProductSortKey)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('filters.sort')} />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t('filters.reset')}
          </Button>
        ) : null}
      </div>
      {isError ? (
        <ErrorState
          title={t('list.errorTitle')}
          description={t('list.errorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <ProductTable
          products={data?.products ?? []}
          isLoading={isLoading}
          onView={(product) => navigate(`/products/${product.id}`)}
          onEdit={(product) => navigate(`/products/${product.id}/edit`)}
          onDelete={handleDelete}
        />
      )}
      <div className="mt-4">
        <DataTablePagination
          page={page}
          totalPages={totalPages}
          summary={t('pagination.summary', { total })}
          pageLabel={t('pagination.page', { page, totalPages })}
          previousLabel={t('pagination.previous')}
          nextLabel={t('pagination.next')}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
