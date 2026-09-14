export function formatMoney(amount, currency = '') {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  const cur = (currency || '').toUpperCase();
  try {
    if (cur && cur.length === 3) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n);
    }
  } catch {
    // fall through
  }
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ''}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(value);
  return s;
}

export function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function confidenceTone(confidence) {
  const c = Number(confidence) || 0;
  if (c >= 85) return 'bg-emerald-500';
  if (c >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}
