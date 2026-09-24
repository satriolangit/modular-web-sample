import type { AxiosInstance } from 'axios';

import type {
  CreateProductInput,
  Product,
  ProductCategory,
  ProductListResponse,
  ProductSortKey,
  UpdateProductInput,
} from '../types';

export const DEFAULT_PRODUCT_SELECT =
  'id,title,category,price,discountPercentage,rating,stock,brand,thumbnail';

export const PRODUCT_SORT_QUERIES: Record<
  ProductSortKey,
  { sortBy?: 'title' | 'price' | 'rating'; order?: 'asc' | 'desc' }
> = {
  default: {},
  'title-asc': { sortBy: 'title', order: 'asc' },
  'price-asc': { sortBy: 'price', order: 'asc' },
  'price-desc': { sortBy: 'price', order: 'desc' },
  'rating-desc': { sortBy: 'rating', order: 'desc' },
};

export interface ProductListParams {
  limit?: number;
  skip?: number;
  search?: string;
  category?: string;
  sortBy?: 'title' | 'price' | 'rating';
  order?: 'asc' | 'desc';
}

export function createProductService(api: AxiosInstance) {
  return {
    async list(params: ProductListParams = {}): Promise<ProductListResponse> {
      const { limit = 10, skip = 0, search, category, sortBy, order } = params;

      const query: Record<string, string | number> = {
        limit,
        skip,
        select: DEFAULT_PRODUCT_SELECT,
      };
      if (sortBy) {
        query.sortBy = sortBy;
      }
      if (order) {
        query.order = order;
      }

      let path = '/products';
      if (search) {
        path = '/products/search';
        query.q = search;
      } else if (category) {
        path = `/products/category/${category}`;
      }

      const res = await api.get<ProductListResponse>(path, { params: query });
      return res.data;
    },

    async getById(id: string | number): Promise<Product> {
      const res = await api.get<Product>(`/products/${id}`);
      return res.data;
    },

    async create(input: CreateProductInput): Promise<Product> {
      const res = await api.post<Product>('/products/add', input);
      return res.data;
    },

    async update(id: string | number, input: UpdateProductInput): Promise<Product> {
      const res = await api.put<Product>(`/products/${id}`, input);
      return res.data;
    },

    async remove(id: string | number): Promise<Product> {
      const res = await api.delete<Product>(`/products/${id}`);
      return res.data;
    },

    async listCategories(): Promise<ProductCategory[]> {
      const res = await api.get<ProductCategory[]>('/products/categories');
      return res.data;
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;
