import { z } from 'zod';

export type TranslateFn = (key: string) => string;

export function createProductSchema(t: TranslateFn) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(3, t('form.errors.titleMin'))
      .max(100, t('form.errors.titleMax')),
    description: z
      .string()
      .trim()
      .min(10, t('form.errors.descriptionMin'))
      .max(1000, t('form.errors.descriptionMax')),
    category: z.string().min(1, t('form.errors.categoryRequired')),
    brand: z.string().trim().max(50, t('form.errors.brandMax')).optional(),
    price: z
      .string()
      .min(1, t('form.errors.priceRequired'))
      .refine((value) => Number(value) > 0, t('form.errors.pricePositive'))
      .refine((value) => Number(value) <= 1_000_000, t('form.errors.priceMax'))
      .transform((value) => Number(value)),
    stock: z
      .string()
      .min(1, t('form.errors.stockRequired'))
      .refine(
        (value) => Number.isInteger(Number(value)) && Number(value) >= 0,
        t('form.errors.stockInteger'),
      )
      .transform((value) => Number(value)),
  });
}

export type ProductFormInput = z.input<ReturnType<typeof createProductSchema>>;
export type ProductFormValues = z.output<ReturnType<typeof createProductSchema>>;

export const EMPTY_PRODUCT_FORM: ProductFormInput = {
  title: '',
  description: '',
  category: '',
  brand: '',
  price: '',
  stock: '',
};
