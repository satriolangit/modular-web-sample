import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Rating } from './Rating';

describe('Rating', () => {
  it('uses the warning token instead of hardcoded amber', () => {
    const { container } = render(<Rating value={4.5} />);
    expect(container.querySelector('svg')).toHaveClass('fill-warning', 'text-warning');
  });
});
