import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('default variant uses brand tokens and token-based hover', () => {
    render(<Button>Simpan</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-primary', 'text-primary-foreground', 'hover:bg-primary-hover');
  });

  it('has a visible 2px focus ring with offset', () => {
    render(<Button>Simpan</Button>);
    expect(screen.getByRole('button')).toHaveClass(
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2',
    );
  });
});
