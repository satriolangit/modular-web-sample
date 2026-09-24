import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({ isDev: false }));

import { useUserStore } from './useUserStore';

describe('useUserStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({ search: '', page: 1, pageSize: 10, selectedId: null });
  });

  it('resets the page when the search term changes', () => {
    useUserStore.getState().setPage(3);
    useUserStore.getState().setSearch('ada');

    expect(useUserStore.getState().search).toBe('ada');
    expect(useUserStore.getState().page).toBe(1);
  });

  it('persists ui state under the module namespace', () => {
    useUserStore.getState().setSearch('john');

    expect(localStorage.getItem('module:user-management')).toContain('john');
  });

  it('resets filters', () => {
    useUserStore.getState().setSearch('ada');
    useUserStore.getState().setPage(4);
    useUserStore.getState().resetFilters();

    expect(useUserStore.getState().search).toBe('');
    expect(useUserStore.getState().page).toBe(1);
  });
});
