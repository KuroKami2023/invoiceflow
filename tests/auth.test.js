import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword } from '../src/utils/authValidate.js';

describe('authentication input validation', () => {
  it('accepts well-formed credentials', () => {
    expect(validateEmail('user@company.com').ok).toBe(true);
    expect(validatePassword('s3cure-pass').ok).toBe(true);
  });

  it('rejects bad emails', () => {
    expect(validateEmail('').ok).toBe(false);
    expect(validateEmail('not-an-email').ok).toBe(false);
    expect(validateEmail('a@b').ok).toBe(false);
  });

  it('rejects weak passwords', () => {
    expect(validatePassword('').ok).toBe(false);
    expect(validatePassword('short').ok).toBe(false);
    expect(validatePassword('1234567').ok).toBe(false);
  });
});
