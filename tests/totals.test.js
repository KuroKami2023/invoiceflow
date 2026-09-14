import { describe, it, expect } from 'vitest';
import { sumLineItems } from '../api/lib/invoiceSchema.js';

describe('total calculations', () => {
  it('sums line totals', () => {
    expect(sumLineItems([
      { total: 378 },
      { total: 108 },
    ])).toBeCloseTo(486);
  });

  it('falls back to quantity × unit_price when total missing', () => {
    expect(sumLineItems([{ quantity: 2, unit_price: 189 }])).toBeCloseTo(378);
  });

  it('ignores lines with no computable amount', () => {
    expect(sumLineItems([{ description: 'unknown' }, { total: 10 }])).toBeCloseTo(10);
    expect(sumLineItems([])).toBe(0);
  });
});
