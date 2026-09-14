/** Shared auth form validation (client-side, mirrors Supabase requirements). */

export function validateEmail(email) {
  const s = String(email || '').trim();
  if (!s) return { ok: false, error: 'Email is required.' };
  if (s.length > 254) return { ok: false, error: 'Email is too long.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true };
}

export function validatePassword(password) {
  const s = String(password || '');
  if (!s) return { ok: false, error: 'Password is required.' };
  if (s.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (s.length > 128) return { ok: false, error: 'Password must be under 128 characters.' };
  return { ok: true };
}
