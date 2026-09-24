import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge semantic variants', () => {
  it.each([
    ['success', 'bg-success/10', 'text-success-strong', 'border-success/20'],
    ['warning', 'bg-warning/10', 'text-warning-strong', 'border-warning/20'],
    ['info', 'bg-info/10', 'text-info-strong', 'border-info/20'],
  ] as const)('%s uses tint pattern', (variant, ...classes) => {
    render(<Badge variant={variant}>{variant}</Badge>);
    expect(screen.getByText(variant)).toHaveClass(...classes);
  });
});
