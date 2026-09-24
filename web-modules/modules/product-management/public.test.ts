import { describe, expect, it, vi } from 'vitest';

vi.mock('@arsi/container', () => ({
  isDev: false,
  useTranslation: () => ({ t: (key: string) => key }),
  useLocale: () => ({ locale: 'en' }),
  useSlot: () => undefined,
  useModal: () => ({ open: vi.fn(), close: vi.fn() }),
  useApiRegistry: () => ({ get: vi.fn() }),
  useEventBus: () => ({ emit: vi.fn(), on: vi.fn() }),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import * as modulePublic from './public';

describe('product-management public API', () => {
  it('exposes the contract consumed by extensions', () => {
    expect(modulePublic.productSlots.productTableActions).toBe(
      'product-management.productTableActions',
    );
    expect(modulePublic.productSlots.productDetailSidebar).toBe(
      'product-management.productDetailSidebar',
    );
    expect(modulePublic.productModals.deleteConfirm).toBe(
      'product-management.deleteConfirm',
    );
    expect(modulePublic.productEvents.created).toBe('product-management.product.created');
    expect(modulePublic.productEvents.updated).toBe('product-management.product.updated');
    expect(modulePublic.productEvents.deleted).toBe('product-management.product.deleted');
    expect(modulePublic.productKeys.all).toEqual(['product-management', 'product']);
    expect(typeof modulePublic.createProductService).toBe('function');
    expect(typeof modulePublic.createProductSchema).toBe('function');
    expect(typeof modulePublic.formatPrice).toBe('function');
    expect(typeof modulePublic.useProductList).toBe('function');
    expect(typeof modulePublic.useProduct).toBe('function');
    expect(typeof modulePublic.useCreateProduct).toBe('function');
    expect(typeof modulePublic.useUpdateProduct).toBe('function');
    expect(typeof modulePublic.useDeleteProduct).toBe('function');
    expect(typeof modulePublic.ProductTable).toBe('function');
    expect(typeof modulePublic.ProductForm).toBe('function');
    expect(typeof modulePublic.ProductListPage).toBe('function');
    expect(typeof modulePublic.useProductStore).toBe('function');
  });
});
