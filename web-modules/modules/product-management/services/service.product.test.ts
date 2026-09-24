import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PRODUCT_SELECT, createProductService } from './service.product';

function createMockApi() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

const baseQuery = { limit: 10, skip: 0, select: DEFAULT_PRODUCT_SELECT };

describe('createProductService', () => {
  it('lists products with pagination and select projection', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { products: [], total: 194, skip: 0, limit: 10 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.list({ limit: 10, skip: 0 });

    expect(api.get).toHaveBeenCalledWith('/products', { params: baseQuery });
  });

  it('uses the search endpoint when a query is provided', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { products: [], total: 0, skip: 0, limit: 10 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.list({ search: 'phone' });

    expect(api.get).toHaveBeenCalledWith('/products/search', {
      params: { ...baseQuery, q: 'phone' },
    });
  });

  it('uses the category endpoint when a category is provided', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { products: [], total: 0, skip: 0, limit: 10 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.list({ category: 'beauty' });

    expect(api.get).toHaveBeenCalledWith('/products/category/beauty', { params: baseQuery });
  });

  it('prefers search over category when both are provided', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { products: [], total: 0, skip: 0, limit: 10 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.list({ search: 'phone', category: 'beauty' });

    expect(api.get.mock.calls[0][0]).toBe('/products/search');
  });

  it('passes sort params to the list endpoint', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { products: [], total: 0, skip: 0, limit: 10 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.list({ sortBy: 'price', order: 'desc' });

    expect(api.get).toHaveBeenCalledWith('/products', {
      params: { ...baseQuery, sortBy: 'price', order: 'desc' },
    });
  });

  it('fetches a product by id', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { id: 7 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.getById(7);

    expect(api.get).toHaveBeenCalledWith('/products/7');
  });

  it('creates a product', async () => {
    const api = createMockApi();
    api.post.mockResolvedValue({ data: { id: 195 } });
    const service = createProductService(api as unknown as AxiosInstance);
    const input = {
      title: 'Wireless Headphones',
      description: 'Great sound quality.',
      category: 'mobile-accessories',
      brand: 'Acme',
      price: 99.99,
      stock: 12,
    };

    await service.create(input);

    expect(api.post).toHaveBeenCalledWith('/products/add', input);
  });

  it('updates a product', async () => {
    const api = createMockApi();
    api.put.mockResolvedValue({ data: { id: 7 } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.update(7, { price: 89.5 });

    expect(api.put).toHaveBeenCalledWith('/products/7', { price: 89.5 });
  });

  it('removes a product', async () => {
    const api = createMockApi();
    api.delete.mockResolvedValue({ data: { id: 7, isDeleted: true } });
    const service = createProductService(api as unknown as AxiosInstance);

    await service.remove(7);

    expect(api.delete).toHaveBeenCalledWith('/products/7');
  });

  it('lists product categories', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: [{ slug: 'beauty', name: 'Beauty', url: '' }] });
    const service = createProductService(api as unknown as AxiosInstance);

    const categories = await service.listCategories();

    expect(api.get).toHaveBeenCalledWith('/products/categories');
    expect(categories[0].slug).toBe('beauty');
  });
});
