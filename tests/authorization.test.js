import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canUserAccessInvoice, filterInvoicesForUser, assertInvoiceOwnership } from '../api/lib/authorization.js';

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, '..', 'supabase', 'schema.sql'), 'utf8');

describe('authorization (ownership)', () => {
  it('grants access only to the owning user', () => {
    expect(canUserAccessInvoice('u1', { user_id: 'u1' })).toBe(true);
    expect(canUserAccessInvoice('u1', { user_id: 'u2' })).toBe(false);
    expect(canUserAccessInvoice(null, { user_id: 'u1' })).toBe(false);
    expect(canUserAccessInvoice('u1', null)).toBe(false);
  });

  it('filters mixed lists down to owned rows', () => {
    const rows = [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u1' }];
    expect(filterInvoicesForUser('u1', rows)).toHaveLength(2);
    expect(filterInvoicesForUser(null, rows)).toHaveLength(0);
  });

  it('assertInvoiceOwnership throws 401/404/403 appropriately', () => {
    expect(() => assertInvoiceOwnership(null, { user_id: 'u1' })).toThrowError(expect.objectContaining({ status: 401 }));
    expect(() => assertInvoiceOwnership('u1', null)).toThrowError(expect.objectContaining({ status: 404 }));
    expect(() => assertInvoiceOwnership('u1', { user_id: 'u2' })).toThrowError(expect.objectContaining({ status: 403 }));
    expect(assertInvoiceOwnership('u1', { user_id: 'u1' })).toBe(true);
  });

  it('schema enforces RLS on all tables', () => {
    for (const table of ['invoices', 'invoice_line_items', 'invoice_processing_runs', 'invoice_events']) {
      expect(schema).toMatch(new RegExp(`enable row level security[\\s\\S]*${table}|alter table public.${table} enable row level security`));
    }
    expect(schema).toContain('auth.uid() = user_id');
  });
});
