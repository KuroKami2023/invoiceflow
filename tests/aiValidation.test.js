import { describe, it, expect } from 'vitest';
import { validateExtraction } from '../api/lib/invoiceSchema.js';

const GOOD = {
  supplier: 'Acme Office Supply Co.',
  invoice_number: 'ACM-1042',
  invoice_date: '2026-08-14',
  due_date: '2026-09-13',
  currency: 'usd',
  subtotal: 486,
  tax: 38.88,
  tax_rate: 8,
  total: 524.88,
  purchase_order: 'PO-1',
  payment_terms: 'Net 30',
  line_items: [
    { description: 'Chair', quantity: 2, unit_price: 189, tax: 30.24, total: 378 },
    { description: 'Desk', quantity: 1, unit_price: 108, tax: 8.64, total: 108 },
  ],
  confidence: 94,
  validation_flags: [],
};

describe('AI response validation (validateExtraction)', () => {
  it('accepts a clean extraction with no flags', () => {
    const { cleaned, flags } = validateExtraction(GOOD);
    expect(flags).toEqual([]);
    expect(cleaned.currency).toBe('USD');
    expect(cleaned.confidence).toBe(94);
    expect(cleaned.line_items).toHaveLength(2);
  });

  it('never invents values: nulls and empty strings preserved', () => {
    const { cleaned } = validateExtraction({ supplier: 'X', confidence: 80 });
    expect(cleaned.invoice_number).toBe('');
    expect(cleaned.total).toBeNull();
    expect(cleaned.line_items).toEqual([]);
    expect(cleaned.due_date).toBeNull();
  });

  it('flags missing fields and invalid dates', () => {
    const { flags, cleaned } = validateExtraction({ supplier: '', invoice_number: '', invoice_date: '2026-02-30', total: null, confidence: 90 });
    expect(flags).toContain('MISSING_SUPPLIER');
    expect(flags).toContain('MISSING_INVOICE_NUMBER');
    expect(flags).toContain('INVALID_DATE');
    expect(flags).toContain('MISSING_TOTAL');
    expect(cleaned.confidence).toBeLessThan(90);
  });

  it('does not flag lines that sum to the subtotal (tax added on top)', () => {
    const { flags } = validateExtraction(GOOD);
    expect(flags).not.toContain('TOTAL_MISMATCH');
  });

  it('flags total mismatch (line sum vs total)', () => {
    const { flags } = validateExtraction({
      ...GOOD,
      line_items: [{ description: 'A', quantity: 1, unit_price: 100, tax: 0, total: 100 }],
      total: 999,
      subtotal: null,
      tax: null,
    });
    expect(flags).toContain('TOTAL_MISMATCH');
  });

  it('flags total mismatch (subtotal + tax vs total)', () => {
    const { flags } = validateExtraction({ ...GOOD, subtotal: 100, tax: 10, total: 500, line_items: [] });
    expect(flags).toContain('TOTAL_MISMATCH');
  });

  it('handles non-object model output without throwing', () => {
    const { cleaned, flags } = validateExtraction('garbage');
    expect(flags).toContain('AI_EXTRACTION_UNCERTAIN');
    expect(cleaned.line_items).toEqual([]);
  });

  it('normalizes 0-1 confidence scale to 0-100', () => {
    const { cleaned } = validateExtraction({ ...GOOD, confidence: 0.9 });
    expect(cleaned.confidence).toBeGreaterThanOrEqual(89);
  });

  it('adds LOW_CONFIDENCE below 60 and OCR_UNCERTAIN from context', () => {
    const { flags } = validateExtraction({ ...GOOD, confidence: 40 }, { ocrUncertain: true });
    expect(flags).toContain('LOW_CONFIDENCE');
    expect(flags).toContain('OCR_UNCERTAIN');
  });

  it('coerces numeric strings and strips currency symbols', () => {
    const { cleaned } = validateExtraction({ ...GOOD, total: '$1,299.00', line_items: [] });
    expect(cleaned.total).toBe(1299);
  });
});
