export const productModals = {
  deleteConfirm: 'product-management.deleteConfirm',
} as const;

export type ProductModalName = (typeof productModals)[keyof typeof productModals];
