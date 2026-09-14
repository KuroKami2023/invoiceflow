/** Client-side duplicate helpers (mirror of api/lib/duplicateCheck.js). */

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
  const existNum = String(existing.invoice_number || '').trim().toLowerCase();
  if (candNum && existNum && candNum === existNum) {
    score += 1;
    reasons.push('same invoice number');
  }
  if (sameDay(candidate.invoice_date, existing.invoice_date)) {
    score += 1;
    reasons.push('same invoice date');
  }
  if (sameMoney(candidate.total, existing.total)) {
    score += 1;
    reasons.push('same total');
  }
  return { score, reasons, isDuplicate: Boolean(supplierMatch && candNum && candNum === existNum && score >= 3) };
}

export function findDuplicates(candidate = {}, existingInvoices = [], currentId = null) {
  const matches = [];
  for (const inv of existingInvoices || []) {
    if (currentId && inv.id === currentId) continue;
    const r = scorePair(candidate, inv);
    if (r.isDuplicate) matches.push({ invoice: inv, score: r.score, reasons: r.reasons });
  }
  matches.sort((a, b) => b.score - a.score);
  return { isPossibleDuplicate: matches.length > 0, matches: matches.slice(0, 5) };
}
