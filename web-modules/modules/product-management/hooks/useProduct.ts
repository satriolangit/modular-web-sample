import { useMemo } from 'react';
import {
  useApiRegistry,
  useEventBus,
  useMutation,
  useQuery,
  useQueryClient,
  useToast,
  useTranslation,
} from '@arsi/container';

import { productEvents } from '../events';
import { productKeys } from '../queryKeys';
import { createProductService, type ProductListParams } from '../services/service.product';
import type {
  CreateProductInput,
  Product,
  ProductListItem,
  ProductListResponse,
  UpdateProductInput,
} from '../types';

type ProductQueryClient = ReturnType<typeof useQueryClient>;

function patchCachedLists(
  queryClient: ProductQueryClient,
  updater: (products: ProductListItem[]) => ProductListItem[],
): void {
  const cachedLists = queryClient.getQueriesData<ProductListResponse>({
    queryKey: productKeys.lists(),
  });

  cachedLists.forEach(([key, data]) => {
    if (!data) {
      return;
    }
    queryClient.setQueryData<ProductListResponse>(key, {
      ...data,
      products: updater(data.products),
    });
  });
}

function useProductService() {
  const apiRegistry = useApiRegistry();
  return useMemo(() => createProductService(apiRegistry.get('product')), [apiRegistry]);
}

export function useProductList(params?: ProductListParams) {
  const service = useProductService();

  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => service.list(params),
  });
}

export function useProduct(id: string | number | undefined) {
  const service = useProductService();

  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => service.getById(id as string | number),
    enabled: Boolean(id),
  });
}

export function useProductCategories() {
  const service = useProductService();

  return useQuery({
    queryKey: productKeys.categories(),
    queryFn: () => service.listCategories(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateProduct() {
  const service = useProductService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const events = useEventBus();
  const { t } = useTranslation('product-management');

  return useMutation({
    mutationFn: (input: CreateProductInput) => service.create(input),
    onSuccess: (product) => {
      queryClient.setQueryData(productKeys.detail(product.id), product);
      toast.success(t('create.success'));
      events.emit(productEvents.created, { product });
    },
    onError: () => {
      toast.error(t('create.error'));
    },
  });
}

export function useUpdateProduct() {
  const service = useProductService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const events = useEventBus();
  const { t } = useTranslation('product-management');

  return useMutation({
    mutationFn: (input: { id: number; changes: UpdateProductInput }) =>
      service.update(input.id, input.changes),
    onMutate: (input) => {
      const listSnapshot = queryClient.getQueriesData<ProductListResponse>({
        queryKey: productKeys.lists(),
      });
      const detailSnapshot = queryClient.getQueryData<Product>(productKeys.detail(input.id));

      patchCachedLists(queryClient, (products) =>
        products.map((product) =>
          product.id === input.id ? { ...product, ...input.changes } : product,
        ),
      );

      if (detailSnapshot) {
        queryClient.setQueryData<Product>(productKeys.detail(input.id), {
          ...detailSnapshot,
          ...input.changes,
        });
      }

      return { listSnapshot, detailSnapshot };
    },
    onError: (_error, input, context) => {
      context?.listSnapshot.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.detailSnapshot) {
        queryClient.setQueryData(productKeys.detail(input.id), context.detailSnapshot);
      }
      toast.error(t('update.error'));
    },
    onSuccess: (product, input) => {
      const currentDetail = queryClient.getQueryData<Product>(productKeys.detail(input.id));
      queryClient.setQueryData<Product>(
        productKeys.detail(input.id),
        currentDetail ? { ...currentDetail, ...input.changes } : product,
      );
      toast.success(t('update.success'));
      events.emit(productEvents.updated, { id: input.id, changes: input.changes });
    },
  });
}

export function useDeleteProduct() {
  const service = useProductService();
  const queryClient = useQueryClient();
  const toast = useToast();
  const events = useEventBus();
  const { t } = useTranslation('product-management');

  return useMutation({
    mutationFn: (id: number) => service.remove(id),
    onMutate: (id) => {
      const listSnapshot = queryClient.getQueriesData<ProductListResponse>({
        queryKey: productKeys.lists(),
      });

      patchCachedLists(queryClient, (products) =>
        products.filter((product) => product.id !== id),
      );

      return { listSnapshot };
    },
    onError: (_error, _id, context) => {
      context?.listSnapshot.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(t('delete.error'));
    },
    onSuccess: (_product, id) => {
      queryClient.removeQueries({ queryKey: productKeys.detail(id) });
      toast.success(t('delete.success'));
      events.emit(productEvents.deleted, { id });
    },
  });
}
