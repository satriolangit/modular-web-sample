import { describe, expect, it } from 'vitest';

import { createProductSchema } from './productSchema';

const t = (key: string) => key;
const schema = createProductSchema(t);

const validInput = {
  title: 'Wireless Headphones',
  description: 'Great sound quality and comfort.',
  category: 'mobile-accessories',
  brand: 'Acme',
  price: '99.99',
  stock: '12',
};

describe('createProductSchema', () => {
  it('accepts valid input and coerces numeric strings', () => {
    const result = schema.safeParse(validInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(99.99);
      expect(result.data.stock).toBe(12);
      expect(result.data.category).toBe('mobile-accessories');
    }
  });

  it('rejects a too short title with an i18n message', () => {
    const result = schema.safeParse({ ...validInput, title: 'ab' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.errors.titleMin');
    }
  });

  it('rejects a too short description', () => {
    const result = schema.safeParse({ ...validInput, description: 'short' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.errors.descriptionMin');
    }
  });

  it('rejects a missing category', () => {
    const result = schema.safeParse({ ...validInput, category: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.errors.categoryRequired');
    }
  });

  it('rejects a non-positive price', () => {
    const result = schema.safeParse({ ...validInput, price: '0' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.errors.pricePositive');
    }
  });

  it('rejects a missing price', () => {
    const result = schema.safeParse({ ...validInput, price: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.errors.priceRequired');
    }
  });

  it('rejects a negative or fractional stock', () => {
    const negative = schema.safeParse({ ...validInput, stock: '-1' });
    expect(negative.success).toBe(false);

    const fractional = schema.safeParse({ ...validInput, stock: '1.5' });
    expect(fractional.success).toBe(false);
    if (!fractional.success) {
      expect(fractional.error.issues[0].message).toBe('form.errors.stockInteger');
    }
  });

  it('rejects a too long brand', () => {
    const result = schema.safeParse({ ...validInput, brand: 'x'.repeat(51) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('form.errors.brandMax');
    }
  });
});
