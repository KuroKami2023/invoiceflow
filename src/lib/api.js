/**
 * Client for our own serverless API. Never sends secrets —
 * the AI provider key stays server-side only and is never referenced here.
 */

async function parseBody(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'Unexpected server response' };
  }
}

export async function processInvoice({ ocrText = '', imageBase64 = '', mimeType = '', filename = '', ocrConfidence = null }) {
  const res = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocrText, imageBase64, mimeType, filename, ocrConfidence }),
  });
  const data = await parseBody(res);
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Processing failed (HTTP ${res.status})`);
  }
  return data;
}

export async function checkDuplicates({ candidate, existing, currentId = null }) {
  const res = await fetch('/api/duplicates-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate, existing, currentId }),
  });
  const data = await parseBody(res);
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Duplicate check failed (HTTP ${res.status})`);
  }
  return data;
}

export async function fetchHealth() {
  const res = await fetch('/api/health');
  return parseBody(res);
}
