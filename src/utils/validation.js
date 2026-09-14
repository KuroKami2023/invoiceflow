/**
 * Client-side mirror of api/lib/invoiceSchema.js for instant UI feedback.
 * The server copy (POST /api/process) is authoritative before persistence.
 */

export function isValidDate(value) {
  if (value === null || value === undefined || value === '') return false;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toNumberOrNull(value) {
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

export function validateFile(file, { maxBytes } = {}) {
  const { ACCEPTED_MIME_TYPES, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES } = {
    ACCEPTED_MIME_TYPES: ['application/pdf', 'image/png', 'image/jpeg'],
    ACCEPTED_EXTENSIONS: ['pdf', 'png', 'jpg', 'jpeg'],
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  };
  const limit = maxBytes || MAX_FILE_SIZE_BYTES;
  if (!file) return { ok: false, error: 'No file provided.' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mimeOk = ACCEPTED_MIME_TYPES.includes(file.type);
  const extOk = ACCEPTED_EXTENSIONS.includes(ext);
  // Some browsers report empty MIME for PDFs — accept by extension in that case.
  if (!mimeOk && !(file.type === '' && extOk)) {
    return { ok: false, error: `Unsupported file type "${file.type || ext}". Use PDF, PNG, JPG, or JPEG.` };
  }
  if (!extOk) {
    return { ok: false, error: `Unsupported extension ".${ext}". Use .pdf, .png, .jpg, .jpeg.` };
  }
  if (file.size > limit) {
    return { ok: false, error: `File "${file.name}" exceeds ${(limit / 1024 / 1024).toFixed(0)}MB.` };
  }
  if (file.size === 0) {
    return { ok: false, error: `File "${file.name}" is empty.` };
  }
  return { ok: true };
}

export function computeValidationFlags(extraction = {}) {
  const flags = new Set(Array.isArray(extraction.validation_flags) ? extraction.validation_flags : []);
  if (!extraction.supplier) flags.add('MISSING_SUPPLIER');
  if (!extraction.invoice_number) flags.add('MISSING_INVOICE_NUMBER');
  if (!extraction.invoice_date) flags.add('MISSING_DATE');
  else if (!isValidDate(extraction.invoice_date)) flags.add('INVALID_DATE');
  if (extraction.total === null || extraction.total === undefined) flags.add('MISSING_TOTAL');
  if ((Number(extraction.confidence) || 0) < 60) flags.add('LOW_CONFIDENCE');
  return [...flags];
}
