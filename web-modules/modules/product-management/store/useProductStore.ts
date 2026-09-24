import { isDev } from '@arsi/container';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { ProductSortKey } from '../types';

export interface ProductUiState {
  search: string;
  category: string | null;
  sort: ProductSortKey;
  page: number;
  pageSize: number;
  setSearch: (search: string) => void;
  setCategory: (category: string | null) => void;
  setSort: (sort: ProductSortKey) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

export const useProductStore = create<ProductUiState>()(
  devtools(
    persist(
      (set) => ({
        search: '',
        category: null,
        sort: 'default',
        page: 1,
        pageSize: 10,
        setSearch: (search) => set({ search, page: 1 }),
        setCategory: (category) => set({ category, page: 1 }),
        setSort: (sort) => set({ sort, page: 1 }),
        setPage: (page) => set({ page }),
        resetFilters: () => set({ search: '', category: null, sort: 'default', page: 1 }),
      }),
      { name: 'module:product-management' },
    ),
    { name: 'product-management', enabled: isDev },
  ),
);
