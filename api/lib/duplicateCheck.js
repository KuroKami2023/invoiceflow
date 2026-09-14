/**
 * Duplicate detection helpers (server copy — mirrors src/utils/duplicate.js).
 * Warning-only: never auto-delete.
 */

export function normalizeSupplier(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[.,;:'"()[\]{}]/g, ' ')
    .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|sarl|pty|plc|bv|sa|sas|ug|ag)\b\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sameMoney(a, b, tolerance = 0.02) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= tolerance;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

/**
 * Score a candidate against one existing invoice.
 * Returns { score (0-4), reasons[], isDuplicate }
 * Duplicate rule: supplier match + invoice_number match + (date or total match).
 */
export function scorePair(candidate = {}, existing = {}) {
  const reasons = [];
  let score = 0;

  const candSup = normalizeSupplier(candidate.supplier);
  const existSup = normalizeSupplier(existing.supplier);
  const supplierMatch = candSup && existSup && (candSup === existSup || candSup.includes(existSup) || existSup.includes(candSup));
  if (supplierMatch) {
    score += 1;
    reasons.push('same supplier');
  }

  const candNum = String(candidate.invoice_number || '').trim().toLowerCase();
  const existNum = String(existing.invoice_number || existing.invoiceNumber || '').trim().toLowerCase();
  const numberMatch = candNum && existNum && candNum === existNum;
  if (numberMatch) {
    score += 1;
    reasons.push('same invoice number');
  }

  if (sameDay(candidate.invoice_date || candidate.invoiceDate, existing.invoice_date || existing.invoiceDate)) {
    score += 1;
    reasons.push('same invoice date');
  }
  if (sameMoney(candidate.total, existing.total)) {
    score += 1;
    reasons.push('same total');
  }

  const isDuplicate = Boolean(supplierMatch && numberMatch && score >= 3);
  return { score, reasons, isDuplicate };
}

export function findDuplicates(candidate = {}, existingInvoices = [], currentId = null) {
  const list = Array.isArray(existingInvoices) ? existingInvoices : [];
  const matches = [];
  for (const inv of list) {
    if (currentId && (inv.id === currentId || inv.invoice_id === currentId)) continue;
    const result = scorePair(candidate, inv);
    if (result.isDuplicate) {
      matches.push({ invoice: inv, score: result.score, reasons: result.reasons });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return { isPossibleDuplicate: matches.length > 0, matches: matches.slice(0, 5) };
}
