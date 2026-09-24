export const productSlots = {
  productTableActions: 'product-management.productTableActions',
  productDetailSidebar: 'product-management.productDetailSidebar',
} as const;

export type ProductSlotName = (typeof productSlots)[keyof typeof productSlots];
