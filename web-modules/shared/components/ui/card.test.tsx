import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent, CardHeader, CardTitle } from './card';

describe('Card', () => {
  it('renders with token-based surface classes and merges className', () => {
    render(
      <Card data-testid="card" className="p-6">
        <CardHeader>
          <CardTitle>Judul</CardTitle>
        </CardHeader>
        <CardContent>Isi</CardContent>
      </Card>,
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('bg-card', 'border', 'shadow-soft', 'p-6');
    expect(screen.getByText('Judul')).toBeInTheDocument();
  });
});
