import { describe, expect, it } from 'vitest';

import { getInitials } from './getInitials';

describe('getInitials', () => {
  it('takes first letters of the first two words', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials('Budi')).toBe('B');
    expect(getInitials('  ')).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });
});
