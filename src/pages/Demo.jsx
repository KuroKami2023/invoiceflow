import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfidenceBar from '../components/ConfidenceBar.jsx';
import ValidationFlags from '../components/ValidationFlags.jsx';
import { DEMO_INVOICES, buildDemoRows } from '../utils/demoData.js';
import { formatMoney, formatDate } from '../utils/format.js';

export default function Demo() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadDemoData() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const rows = buildDemoRows(user.id);
      const { data: inserted, error: insErr } = await supabase.from('invoices').insert(rows).select('id');
      if (insErr) throw new Error(insErr.message);

      // Insert line items for each demo invoice (match by order)
      const withIds = (inserted || []).map((row, i) => ({ ...row, demo: DEMO_INVOICES[i] }));
      for (const item of withIds) {
        if (item.demo.line_items?.length) {
          await supabase.from('invoice_line_items').insert(
            item.demo.line_items.map((li) => ({
              invoice_id: item.id,
              description: li.description,
              quantity: li.quantity,
              unit_price: li.unit_price,
              tax: li.tax,
              total: li.total,
            })),
          );
        }
        await supabase.from('invoice_processing_runs').insert({
          invoice_id: item.id,
          processing_type: 'demo',
          status: 'succeeded',
          duration_ms: 1200,
        });
        await supabase.from('invoice_events').insert({
          invoice_id: item.id,
          user_id: user.id,
          event_type: 'created',
          metadata: { source: 'demo' },
        });
      }
      setMessage(`Loaded ${withIds.length} demo invoices into your account.`);
    } catch (err) {
      setError(err.message || 'Could not load demo data');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-5" style={{ borderColor: '#e5ddc6' }}>
        <div>
          <p className="eyebrow">Specimen book</p>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink-900">Demo mode</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
            Synthetic, fictional invoices — no real company data. Preview the full review workflow here, or load
            them into your account to try search, approve/reject, and exports.
          </p>
        </div>
        <button className="btn-primary" onClick={loadDemoData} disabled={busy}>
          {busy ? 'Loading…' : 'Load demo invoices into my account'}
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-brand-700/30 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {message}{' '}
          <Link to="/invoices" className="inline-flex items-center gap-1 font-bold underline decoration-brass-600 decoration-2 underline-offset-2">
            View invoices
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </p>
      ) : null}
      {error ? <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {DEMO_INVOICES.map((d, i) => (
          <div key={i} className="card space-y-2 p-5">
            <div className="flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: '#ece5d0' }}>
              <h2 className="font-serif text-[17px] font-bold text-ink-900">{d.supplier || '(unknown supplier)'}</h2>
              <StatusBadge status={d.status} />
            </div>
            <p className="tnum font-mono text-xs text-ink-500">{d.invoice_number || 'no number'} · {formatDate(d.invoice_date)}</p>
            <p className="tnum font-serif text-2xl font-bold tracking-tight text-brand-800">{formatMoney(d.total, d.currency)}</p>
            <div className="rule-brass w-10" aria-hidden="true" />
            <ConfidenceBar value={d.confidence} />
            <ValidationFlags flags={d.validation_flags} />
          </div>
        ))}
      </div>
    </div>
  );
}
