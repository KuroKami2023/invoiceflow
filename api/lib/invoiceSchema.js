/**
 * Server-side invoice extraction validation + normalization.
 * Mirrors src/utils/validation.js so client previews match server results.
 * The server copy is authoritative for anything persisted.
 */

export const VALIDATION_FLAGS = [
  'MISSING_INVOICE_NUMBER',
  'MISSING_SUPPLIER',
  'MISSING_DATE',
  'LOW_CONFIDENCE',
  'TOTAL_MISMATCH',
  'INVALID_DATE',
  'POSSIBLE_DUPLICATE',
  'MISSING_TOTAL',
  'OCR_UNCERTAIN',
  'AI_EXTRACTION_UNCERTAIN',
];

export const ALLOWED_STATUSES = ['uploaded', 'processing', 'needs_review', 'approved', 'rejected'];

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$€£,\s]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStringOrEmpty(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function isValidDate(value) {
  if (value === null || value === undefined || value === '') return false;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function normalizeConfidence(value) {
  const n = toNumberOrNull(value);
  if (n === null) return 0;
  // Accept 0-1 or 0-100 scales
  const scaled = n <= 1 && n > 0 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function cleanLineItem(item = {}) {
  return {
    description: toStringOrEmpty(item.description),
    quantity: toNumberOrNull(item.quantity),
    unit_price: toNumberOrNull(item.unit_price),
    tax: toNumberOrNull(item.tax),
    total: toNumberOrNull(item.total),
  };
}

export function sumLineItems(lineItems) {
  return lineItems.reduce((acc, li) => {
    if (typeof li.total === 'number') return acc + li.total;
    if (typeof li.quantity === 'number' && typeof li.unit_price === 'number') {
      return acc + li.quantity * li.unit_price;
    }
    return acc;
  }, 0);
}

function amountsMatch(a, b, tolerance = 0.02) {
  if (a === null || b === null) return true; // can't judge
  return Math.abs(a - b) <= tolerance;
}

/**
 * Validate + normalize raw model JSON into the canonical extraction shape.
 * Never throws on bad model output — returns flags instead.
 */
export function validateExtraction(raw = {}, context = {}) {
  const flags = new Set();
  const source = raw && typeof raw === 'object' ? raw : {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    flags.add('AI_EXTRACTION_UNCERTAIN');
  }

  const cleaned = {
    supplier: toStringOrEmpty(source.supplier),
    invoice_number: toStringOrEmpty(source.invoice_number),
    invoice_date: toNullableString(source.invoice_date) || '',
    due_date: toNullableString(source.due_date),
    currency: toStringOrEmpty(source.currency).toUpperCase().slice(0, 3),
    subtotal: toNumberOrNull(source.subtotal),
    tax: toNumberOrNull(source.tax),
    tax_rate: toNumberOrNull(source.tax_rate),
    total: toNumberOrNull(source.total),
    purchase_order: toNullableString(source.purchase_order),
    payment_terms: toNullableString(source.payment_terms),
    line_items: Array.isArray(source.line_items) ? source.line_items.slice(0, 200).map(cleanLineItem) : [],
    confidence: normalizeConfidence(source.confidence),
    validation_flags: [],
  };

  if (!cleaned.supplier) flags.add('MISSING_SUPPLIER');
  if (!cleaned.invoice_number) flags.add('MISSING_INVOICE_NUMBER');
  if (!cleaned.invoice_date) {
    flags.add('MISSING_DATE');
  } else if (!isValidDate(cleaned.invoice_date)) {
    flags.add('INVALID_DATE');
  }
  if (cleaned.due_date !== null && !isValidDate(cleaned.due_date)) {
    flags.add('INVALID_DATE');
    cleaned.due_date = null;
  }
  if (cleaned.total === null) flags.add('MISSING_TOTAL');

  // Total consistency: line items vs total/subtotal, subtotal+tax vs total.
  // Lines commonly sum to the subtotal (tax added on top), so a line sum is
  // only suspicious when it matches NEITHER total NOR subtotal.
  const lineSum = sumLineItems(cleaned.line_items);
  if (cleaned.line_items.length > 0 && lineSum > 0) {
    const matchesTotal = cleaned.total !== null && amountsMatch(lineSum, cleaned.total, 0.05);
    const matchesSubtotal = cleaned.subtotal !== null && amountsMatch(lineSum, cleaned.subtotal, 0.05);
    if (!matchesTotal && !matchesSubtotal) {
      // Only flag when every line has a computable amount (avoid false positives)
      const computable = cleaned.line_items.filter(
        (li) => typeof li.total === 'number' || (typeof li.quantity === 'number' && typeof li.unit_price === 'number'),
      );
      if (computable.length === cleaned.line_items.length) {
        flags.add('TOTAL_MISMATCH');
      }
    }
  }
  if (cleaned.subtotal !== null && cleaned.tax !== null && cleaned.total !== null) {
    if (!amountsMatch(cleaned.subtotal + cleaned.tax, cleaned.total, 0.05)) {
      flags.add('TOTAL_MISMATCH');
    }
  }

  if (context.ocrUncertain) flags.add('OCR_UNCERTAIN');
  if (context.possibleDuplicate) flags.add('POSSIBLE_DUPLICATE');

  // Confidence: penalize missing critical fields + mismatches
  let confidence = cleaned.confidence;
  if (confidence === 0) {
    // Model gave no confidence — derive a conservative one
    confidence = 70;
    flags.add('AI_EXTRACTION_UNCERTAIN');
  }
  if (flags.has('MISSING_SUPPLIER')) confidence -= 15;
  if (flags.has('MISSING_INVOICE_NUMBER')) confidence -= 15;
  if (flags.has('MISSING_DATE') || flags.has('INVALID_DATE')) confidence -= 10;
  if (flags.has('MISSING_TOTAL')) confidence -= 20;
  if (flags.has('TOTAL_MISMATCH')) confidence -= 15;
  if (flags.has('OCR_UNCERTAIN')) confidence -= 10;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));
  cleaned.confidence = confidence;
  if (confidence < 60) flags.add('LOW_CONFIDENCE');

  // Preserve any model flags that are in our allow-list
  if (Array.isArray(source.validation_flags)) {
    for (const f of source.validation_flags) {
      if (VALIDATION_FLAGS.includes(f)) flags.add(f);
    }
  }

  cleaned.validation_flags = [...flags];
  return { cleaned, flags: cleaned.validation_flags, lineSum };
}

export const __internal = { toNumberOrNull, toStringOrEmpty, normalizeConfidence };
