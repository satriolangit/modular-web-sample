import type { Product } from './types';

export const productEvents = {
  created: 'product-management.product.created',
  updated: 'product-management.product.updated',
  deleted: 'product-management.product.deleted',
} as const;

export interface ProductCreatedPayload {
  product: Product;
}

export interface ProductUpdatedPayload {
  id: number;
  changes: Partial<Product>;
}

export interface ProductDeletedPayload {
  id: number;
}
