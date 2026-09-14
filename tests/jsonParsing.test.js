import { describe, it, expect } from 'vitest';
import { extractJsonObject } from '../api/services/nvidiaAI.js';

describe('AI JSON parsing (extractJsonObject)', () => {
  it('parses raw JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences', () => {
    const text = '```json\n{"supplier":"Acme","total":10}\n```';
    expect(extractJsonObject(text)).toEqual({ supplier: 'Acme', total: 10 });
  });

  it('extracts JSON embedded in prose', () => {
    const text = 'Here is the extraction:\n{"invoice_number":"X-1","total":5}\nDone.';
    expect(extractJsonObject(text)).toEqual({ invoice_number: 'X-1', total: 5 });
  });

  it('repairs trailing commas', () => {
    expect(extractJsonObject('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
  });

  it('throws on empty or non-JSON responses', () => {
    expect(() => extractJsonObject('')).toThrow();
    expect(() => extractJsonObject('no json here')).toThrow();
    expect(() => extractJsonObject(null)).toThrow();
  });
});
