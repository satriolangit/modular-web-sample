export interface ProductListItem {
  id: number;
  title: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand?: string;
  thumbnail: string;
}

export interface ProductReview {
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  reviewerEmail: string;
}

export interface ProductDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface ProductMeta {
  createdAt: string;
  updatedAt: string;
  barcode: string;
  qrCode: string;
}

export interface Product extends ProductListItem {
  description: string;
  tags: string[];
  sku: string;
  weight: number;
  dimensions: ProductDimensions;
  warrantyInformation: string;
  shippingInformation: string;
  availabilityStatus: string;
  reviews: ProductReview[];
  returnPolicy: string;
  minimumOrderQuantity: number;
  meta: ProductMeta;
  images: string[];
}

export interface ProductListResponse<TProduct = ProductListItem> {
  products: TProduct[];
  total: number;
  skip: number;
  limit: number;
}

export interface ProductCategory {
  slug: string;
  name: string;
  url: string;
}

export interface CreateProductInput {
  title: string;
  description: string;
  category: string;
  brand?: string;
  price: number;
  stock: number;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export type ProductSortKey =
  | 'default'
  | 'title-asc'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc';

export interface ProductDeletePayload {
  id: number;
  title: string;
  onDeleted?: () => void;
}
