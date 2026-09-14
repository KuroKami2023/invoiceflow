/** Shared request helpers: body parsing, IP, safe JSON responses. */

export const MAX_JSON_BODY_BYTES = 14_000_000; // ~14MB (covers base64 image + OCR text)
export const MAX_OCR_TEXT_CHARS = 60_000;
export const MAX_IMAGE_BASE64_CHARS = 8_000_000;

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    if (Buffer.byteLength(req.body) > maxBytes) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    try {
      return JSON.parse(req.body);
    } catch {
      throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
    }
  }
  return await new Promise((resolve, reject) => {
    let size = 0;
    let data = '';
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

/** Map any thrown error to a safe client-facing message (no internals leak). */
export function toPublicError(err) {
  const status = err && Number.isInteger(err.status) ? err.status : 500;
  const message =
    (err && err.publicMessage) ||
    (status === 400 && 'Invalid request.') ||
    (status === 413 && 'Payload too large.') ||
    (status === 429 && 'Too many requests. Please slow down.') ||
    'Something went wrong. Please retry.';
  return { status: status >= 400 && status < 600 ? status : 500, message };
}

export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];

export function validateProcessInput(body = {}) {
  const { ocrText = '', imageBase64 = '', mimeType = '', filename = '' } = body;
  if (typeof ocrText !== 'string' || typeof imageBase64 !== 'string') {
    throw Object.assign(new Error('ocrText and imageBase64 must be strings'), { status: 400 });
  }
  if (!ocrText.trim() && !imageBase64) {
    throw Object.assign(new Error('Provide OCR text and/or an invoice image'), {
      status: 400,
      publicMessage: 'Provide OCR text and/or an invoice image for extraction.',
    });
  }
  if (ocrText.length > MAX_OCR_TEXT_CHARS) {
    throw Object.assign(new Error('OCR text too long'), {
      status: 413,
      publicMessage: 'OCR text is too long. Please use a shorter document.',
    });
  }
  if (imageBase64 && imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    throw Object.assign(new Error('Image too large'), {
      status: 413,
      publicMessage: 'Image is too large. Please upload a file under 6MB.',
    });
  }
  if (imageBase64 && mimeType && !ALLOWED_IMAGE_MIME.includes(mimeType)) {
    throw Object.assign(new Error('Unsupported image type'), {
      status: 400,
      publicMessage: 'Unsupported image type. Use PNG, JPG, or WEBP.',
    });
  }
  if (filename && String(filename).length > 255) {
    throw Object.assign(new Error('Filename too long'), { status: 400 });
  }
  return {
    ocrText: ocrText.slice(0, MAX_OCR_TEXT_CHARS),
    imageBase64,
    mimeType: mimeType || '',
    filename: String(filename || '').slice(0, 255),
    ocrConfidence: typeof body.ocrConfidence === 'number' ? body.ocrConfidence : null,
  };
}
