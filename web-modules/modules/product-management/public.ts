export {
  useProductList,
  useProduct,
  useProductCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from './hooks/useProduct';
export { ProductListPage } from './pages/ProductListPage';
export { ProductDetailPage } from './pages/ProductDetailPage';
export { ProductCreatePage } from './pages/ProductCreatePage';
export { ProductEditPage } from './pages/ProductEditPage';
export { ProductTable, type ProductTableProps } from './components/ProductTable';
export { ProductForm, type ProductFormProps } from './components/ProductForm';
export {
  ProductDetailCard,
  type ProductDetailCardProps,
} from './components/ProductDetailCard';
export {
  ProductDeleteDialog,
  type ProductDeleteDialogProps,
} from './components/ProductDeleteDialog';
export {
  createProductService,
  PRODUCT_SORT_QUERIES,
  DEFAULT_PRODUCT_SELECT,
  type ProductService,
  type ProductListParams,
} from './services/service.product';
export {
  createProductSchema,
  EMPTY_PRODUCT_FORM,
  type ProductFormInput,
  type ProductFormValues,
} from './schemas/productSchema';
export { formatPrice } from './lib/format';
export { productKeys } from './queryKeys';
export { productSlots, type ProductSlotName } from './slots';
export { productModals, type ProductModalName } from './modals';
export {
  productEvents,
  type ProductCreatedPayload,
  type ProductUpdatedPayload,
  type ProductDeletedPayload,
} from './events';
export { useProductStore, type ProductUiState } from './store/useProductStore';
export type {
  Product,
  ProductListItem,
  ProductListResponse,
  ProductCategory,
  ProductReview,
  ProductDimensions,
  ProductMeta,
  CreateProductInput,
  UpdateProductInput,
  ProductSortKey,
  ProductDeletePayload,
} from './types';
