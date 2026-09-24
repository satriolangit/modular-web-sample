import { Star } from 'lucide-react';

import { cn } from '../../lib/utils';

export interface RatingProps {
  value: number;
  max?: number;
  className?: string;
}

export function Rating({ value, max = 5, className }: RatingProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <Star aria-hidden className="h-4 w-4 fill-warning text-warning" />
      <span className="font-medium">{value.toFixed(1)}</span>
      <span className="text-muted-foreground">/ {max}</span>
    </span>
  );
}
