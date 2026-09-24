import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({ isDev: false }));

import { useProductStore } from './useProductStore';

describe('useProductStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useProductStore.setState({
      search: '',
      category: null,
      sort: 'default',
      page: 1,
      pageSize: 10,
    });
  });

  it('resets the page when the search term changes', () => {
    useProductStore.getState().setPage(4);
    useProductStore.getState().setSearch('phone');

    expect(useProductStore.getState().search).toBe('phone');
    expect(useProductStore.getState().page).toBe(1);
  });

  it('resets the page when the category or sort changes', () => {
    useProductStore.getState().setPage(3);
    useProductStore.getState().setCategory('beauty');
    expect(useProductStore.getState().page).toBe(1);

    useProductStore.getState().setPage(3);
    useProductStore.getState().setSort('price-desc');
    expect(useProductStore.getState().page).toBe(1);
  });

  it('persists ui state under the module namespace', () => {
    useProductStore.getState().setCategory('beauty');

    expect(localStorage.getItem('module:product-management')).toContain('beauty');
  });

  it('resets filters', () => {
    useProductStore.getState().setSearch('phone');
    useProductStore.getState().setCategory('beauty');
    useProductStore.getState().setSort('title-asc');
    useProductStore.getState().resetFilters();

    const state = useProductStore.getState();
    expect(state.search).toBe('');
    expect(state.category).toBeNull();
    expect(state.sort).toBe('default');
    expect(state.page).toBe(1);
  });
});
