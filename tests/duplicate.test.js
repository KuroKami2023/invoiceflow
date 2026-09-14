import { describe, it, expect } from 'vitest';
import { normalizeSupplier, scorePair, findDuplicates } from '../api/lib/duplicateCheck.js';

describe('duplicate detection', () => {
  it('normalizes legal suffixes and punctuation', () => {
    expect(normalizeSupplier('Acme Office Supply Co., Inc.')).toBe(normalizeSupplier('acme office supply LLC'));
    expect(normalizeSupplier('Northwind-Cloud GmbH')).toContain('northwind');
  });

  it('detects exact duplicates', () => {
    const cand = { supplier: 'Acme Inc.', invoice_number: 'ACM-1', invoice_date: '2026-08-14', total: 524.88 };
    const exist = { supplier: 'Acme', invoice_number: 'ACM-1', invoice_date: '2026-08-14', total: 524.88 };
    expect(scorePair(cand, exist).isDuplicate).toBe(true);
  });

  it('does not flag different invoice numbers', () => {
    const cand = { supplier: 'Acme', invoice_number: 'ACM-1', invoice_date: '2026-08-14', total: 100 };
    const exist = { supplier: 'Acme', invoice_number: 'ACM-2', invoice_date: '2026-08-14', total: 100 };
    expect(scorePair(cand, exist).isDuplicate).toBe(false);
  });

  it('does not flag different suppliers with same number', () => {
    const cand = { supplier: 'Acme', invoice_number: 'X-1', invoice_date: '2026-08-14', total: 100 };
    const exist = { supplier: 'Globex', invoice_number: 'X-1', invoice_date: '2026-08-14', total: 100 };
    expect(scorePair(cand, exist).isDuplicate).toBe(false);
  });

  it('tolerates rounding differences in totals', () => {
    const cand = { supplier: 'Acme', invoice_number: 'X-1', invoice_date: '2026-08-14', total: 100.0 };
    const exist = { supplier: 'Acme', invoice_number: 'X-1', invoice_date: '2026-08-15', total: 100.01 };
    // supplier + number match, total within tolerance → still needs date or total; date differs, total matches
    expect(scorePair(cand, exist).isDuplicate).toBe(true);
  });

  it('findDuplicates skips the current invoice and caps matches', () => {
    const cand = { supplier: 'Acme', invoice_number: 'X-1', invoice_date: '2026-08-14', total: 100 };
    const list = [
      { id: 'self', supplier: 'Acme', invoice_number: 'X-1', invoice_date: '2026-08-14', total: 100 },
      { id: 'other', supplier: 'Acme Inc', invoice_number: 'X-1', invoice_date: '2026-08-14', total: 100 },
    ];
    const r = findDuplicates(cand, list, 'self');
    expect(r.isPossibleDuplicate).toBe(true);
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].invoice.id).toBe('other');
  });

  it('returns no duplicates for empty history', () => {
    const r = findDuplicates({ supplier: 'Acme', invoice_number: 'X-1' }, []);
    expect(r.isPossibleDuplicate).toBe(false);
  });
});
