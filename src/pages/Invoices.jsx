import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import InvoiceTable from '../components/InvoiceTable.jsx';
import { exportInvoicesCsv, exportInvoicesJson } from '../utils/export.js';

export default function Invoices() {
  const [params, setParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!mounted) return;
      if (err) setError(err.message);
      else setInvoices(data || []);
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const s = params.get('status') || '';
    setStatus(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status && inv.status !== status) return false;
      if (needle) {
        const hay = `${inv.supplier || ''} ${inv.invoice_number || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const d = (inv.invoice_date || '').slice(0, 10);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (dateFrom && !d) return false;
      if (dateTo && !d) return false;
      const total = Number(inv.total);
      if (minAmount !== '' && !(Number.isFinite(total) && total >= Number(minAmount))) return false;
      if (maxAmount !== '' && !(Number.isFinite(total) && total <= Number(maxAmount))) return false;
      return true;
    });
  }, [invoices, q, status, dateFrom, dateTo, minAmount, maxAmount]);

  function updateStatus(next) {
    setStatus(next);
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('status', next);
    else nextParams.delete('status');
    setParams(nextParams, { replace: true });
  }

  async function handleExportCsv() {
    for (const inv of filtered) {
      await supabase.from('invoice_events').insert({ invoice_id: inv.id, event_type: 'exported', metadata: { format: 'csv' } });
    }
    exportInvoicesCsv(filtered);
  }

  function handleExportJson() {
    filtered.forEach((inv) => {
      supabase.from('invoice_events').insert({ invoice_id: inv.id, event_type: 'exported', metadata: { format: 'json' } });
    });
    exportInvoicesJson(filtered);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-5" style={{ borderColor: '#e5ddc6' }}>
        <div>
          <p className="eyebrow">Registry</p>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink-900">Invoices</h1>
          <p className="mt-1 text-sm text-ink-500">Search history by supplier, number, date, status, or amount.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleExportCsv} disabled={!filtered.length}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8M5 7l3 3 3-3M2.5 12.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
          <button className="btn-secondary" onClick={handleExportJson} disabled={!filtered.length}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8M5 7l3 3 3-3M2.5 12.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      <div className="card grid grid-cols-1 gap-3 p-5 md:grid-cols-3 lg:grid-cols-6">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">Supplier / number</label>
          <input id="q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="acme, NW-88190…" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className="input" value={status} onChange={(e) => updateStatus(e.target.value)}>
            <option value="">All</option>
            <option value="needs_review">Needs review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="processing">Processing</option>
            <option value="uploaded">Uploaded</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="from">From</label>
          <input id="from" className="input tnum" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <input id="to" className="input tnum" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="min">Min $</label>
            <input id="min" className="input tnum" type="number" step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="max">Max $</label>
            <input id="max" className="input tnum" type="number" step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card space-y-2 p-5" aria-label="Loading invoices">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : (
        <div className="card p-5">
          <p className="tnum mb-2 border-b pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500" style={{ borderColor: '#e5ddc6' }}>
            {filtered.length} of {invoices.length} invoices
          </p>
          <InvoiceTable invoices={filtered} />
        </div>
      )}
    </div>
  );
}
