export const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_BATCH = 10;

export const STATUS_LABELS = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  needs_review: 'Needs review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const FLAG_DESCRIPTIONS = {
  MISSING_INVOICE_NUMBER: 'Invoice number could not be determined.',
  MISSING_SUPPLIER: 'Supplier name could not be determined.',
  MISSING_DATE: 'Invoice date could not be determined.',
  LOW_CONFIDENCE: 'Overall extraction confidence is low — verify fields manually.',
  TOTAL_MISMATCH: 'Line-item / subtotal+tax arithmetic does not match the total.',
  INVALID_DATE: 'A date value is not a valid calendar date.',
  POSSIBLE_DUPLICATE: 'Another invoice with the same supplier + number + date/total exists.',
  MISSING_TOTAL: 'Total amount could not be determined.',
  OCR_UNCERTAIN: 'OCR quality was poor — cross-check against the original file.',
  AI_EXTRACTION_UNCERTAIN: 'The AI model was uncertain — every field needs review.',
};
