import { describe, it, expect } from 'vitest';
import { isValidDate, validateFile, computeValidationFlags } from '../src/utils/validation.js';

function fakeFile({ name = 'invoice.pdf', type = 'application/pdf', size = 1024 } = {}) {
  return { name, type, size };
}

describe('invoice file validation', () => {
  it('accepts pdf, png, jpg, jpeg', () => {
    expect(validateFile(fakeFile({ name: 'a.pdf', type: 'application/pdf' })).ok).toBe(true);
    expect(validateFile(fakeFile({ name: 'a.png', type: 'image/png' })).ok).toBe(true);
    expect(validateFile(fakeFile({ name: 'a.jpg', type: 'image/jpeg' })).ok).toBe(true);
    expect(validateFile(fakeFile({ name: 'a.jpeg', type: 'image/jpeg' })).ok).toBe(true);
  });

  it('rejects unsupported types', () => {
    expect(validateFile(fakeFile({ name: 'a.exe', type: 'application/x-msdownload' })).ok).toBe(false);
    expect(validateFile(fakeFile({ name: 'a.txt', type: 'text/plain' })).ok).toBe(false);
    expect(validateFile(fakeFile({ name: 'a.svg', type: 'image/svg+xml' })).ok).toBe(false);
  });

  it('rejects oversized and empty files', () => {
    expect(validateFile(fakeFile({ size: 11 * 1024 * 1024 })).ok).toBe(false);
    expect(validateFile(fakeFile({ size: 0 })).ok).toBe(false);
  });

  it('accepts pdf with empty mime (some browsers) when extension matches', () => {
    expect(validateFile(fakeFile({ name: 'scan.pdf', type: '' })).ok).toBe(true);
  });
});

describe('date validation', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-08-14')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('14/08/2026')).toBe(false);
    expect(isValidDate('')).toBe(false);
    expect(isValidDate(null)).toBe(false);
    expect(isValidDate('not-a-date')).toBe(false);
  });
});

describe('client validation flags', () => {
  it('flags missing critical fields', () => {
    const flags = computeValidationFlags({ supplier: '', invoice_number: '', invoice_date: '', total: null, confidence: 90 });
    expect(flags).toContain('MISSING_SUPPLIER');
    expect(flags).toContain('MISSING_INVOICE_NUMBER');
    expect(flags).toContain('MISSING_DATE');
    expect(flags).toContain('MISSING_TOTAL');
  });

  it('flags low confidence', () => {
    expect(computeValidationFlags({ supplier: 'X', invoice_number: '1', invoice_date: '2026-01-01', total: 10, confidence: 20 })).toContain('LOW_CONFIDENCE');
  });
});
