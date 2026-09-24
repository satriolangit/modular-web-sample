import { isDev } from '@arsi/container';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface UserUiState {
  search: string;
  page: number;
  pageSize: number;
  selectedId: number | null;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  setSelectedId: (id: number | null) => void;
  resetFilters: () => void;
}

export const useUserStore = create<UserUiState>()(
  devtools(
    persist(
      (set) => ({
        search: '',
        page: 1,
        pageSize: 10,
        selectedId: null,
        setSearch: (search) => set({ search, page: 1 }),
        setPage: (page) => set({ page }),
        setSelectedId: (selectedId) => set({ selectedId }),
        resetFilters: () => set({ search: '', page: 1 }),
      }),
      { name: 'module:user-management' },
    ),
    { name: 'user-management', enabled: isDev },
  ),
);
