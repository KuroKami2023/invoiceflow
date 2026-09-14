/**
 * Authorization helpers — pure functions encoding the same ownership rule
 * enforced by Supabase RLS (auth.uid() = user_id). Defense in depth:
 * RLS is authoritative; these helpers gate UI actions + tests.
 */

export function canUserAccessInvoice(userId, invoice) {
  if (!userId || !invoice) return false;
  return invoice.user_id === userId;
}

export function filterInvoicesForUser(userId, invoices = []) {
  if (!userId) return [];
  return (invoices || []).filter((inv) => inv.user_id === userId);
}

export function assertInvoiceOwnership(userId, invoice) {
  if (!userId) {
    throw Object.assign(new Error('Not authenticated'), { status: 401 });
  }
  if (!invoice) {
    throw Object.assign(new Error('Invoice not found'), { status: 404 });
  }
  if (invoice.user_id !== userId) {
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }
  return true;
}
