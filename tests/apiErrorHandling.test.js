import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toPublicError, validateProcessInput } from '../api/lib/requestUtils.js';
import { checkRateLimit } from '../api/lib/rateLimit.js';
import { __internal } from '../api/services/nvidiaAI.js';

describe('API error handling', () => {
  it('maps errors to safe public messages (no internals)', () => {
    const secretErr = Object.assign(new Error('connect NVIDIA_API_KEY=sk-live-123 failed'), { status: 500 });
    const pub = toPublicError(secretErr);
    expect(pub.status).toBe(500);
    expect(JSON.stringify(pub)).not.toContain('sk-live');
    expect(pub.message).toBeTruthy();
  });

  it('preserves client error statuses', () => {
    expect(toPublicError({ status: 400 }).status).toBe(400);
    expect(toPublicError({ status: 429 }).status).toBe(429);
  });

  it('rejects empty extraction input', () => {
    expect(() => validateProcessInput({ ocrText: '', imageBase64: '' })).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('rejects oversized image payloads', () => {
    expect(() => validateProcessInput({ ocrText: '', imageBase64: 'a'.repeat(8_000_001) })).toThrowError(
      expect.objectContaining({ status: 413 }),
    );
  });

  it('rejects unsupported image mime types', () => {
    expect(() => validateProcessInput({ ocrText: '', imageBase64: 'abc', mimeType: 'image/gif' })).toThrowError(
      expect.objectContaining({ status: 400 }),
    );
  });

  it('rate limiter blocks after the limit', () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit({ key, limit: 5, windowMs: 60000 }).allowed).toBe(true);
    }
    expect(checkRateLimit({ key, limit: 5, windowMs: 60000 }).allowed).toBe(false);
  });

  it('classifies retryable failures correctly', () => {
    expect(__internal.isRetryable({ status: 429 })).toBe(true);
    expect(__internal.isRetryable({ status: 503 })).toBe(true);
    expect(__internal.isRetryable({ status: 400 })).toBe(false);
    expect(__internal.isRetryable({ name: 'AbortError' })).toBe(true);
  });

  it('buildMessages always includes text content and optional image', () => {
    const textOnly = __internal.buildMessages({ ocrText: 'hello', imageBase64: '', mimeType: '', filename: 'a.pdf' });
    expect(textOnly).toHaveLength(2);
    expect(textOnly[0].role).toBe('system');
    const withImage = __internal.buildMessages({ ocrText: '', imageBase64: 'abc123', mimeType: 'image/png', filename: '' });
    expect(withImage[1].content.some((c) => c.type === 'image_url')).toBe(true);
  });

  it('extractInvoice throws a public 500 when the key is missing', async () => {
    const prev = process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    const { extractInvoice } = await import('../api/services/nvidiaAI.js');
    await expect(extractInvoice({ ocrText: 'test' }, { maxRetries: 0 })).rejects.toMatchObject({ status: 500 });
    if (prev !== undefined) process.env.NVIDIA_API_KEY = prev;
  });
});
