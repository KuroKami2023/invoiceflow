import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfidenceBar from '../components/ConfidenceBar.jsx';
import ValidationFlags from '../components/ValidationFlags.jsx';
import { formatMoney, formatDate, formatDateTime } from '../utils/format.js';
import { isValidDate, toNumberOrNull } from '../utils/validation.js';
import { findDuplicates } from '../utils/duplicate.js';
// NOTE: ../utils/ocr.js is dynamically imported in handleReprocess (code-split).
import { processInvoice } from '../lib/api.js';

function emptyLine() {
  return { description: '', quantity: '', unit_price: '', tax: '', total: '' };
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [lines, setLines] = useState([]);
  const [events, setEvents] = useState([]);
  const [others, setOthers] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewKind, setPreviewKind] = useState(''); // image | pdf | none
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    const [{ data: inv, error: invErr }, { data: lineRows }] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_line_items').select('*').eq('invoice_id', id),
    ]);
    if (invErr || !inv) {
      setError(invErr?.message || 'Invoice not found or you do not have access.');
      setLoading(false);
      return;
    }
    setInvoice(inv);
    setLines(lineRows || []);
    setForm({
      supplier: inv.supplier || '',
      invoice_number: inv.invoice_number || '',
      invoice_date: (inv.invoice_date || '').slice(0, 10),
      due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : '',
      currency: inv.currency || '',
      subtotal: inv.subtotal ?? '',
      tax: inv.tax ?? '',
      tax_rate: inv.tax_rate ?? '',
      total: inv.total ?? '',
      purchase_order: inv.purchase_order || '',
      payment_terms: inv.payment_terms || '',
    });
    const [{ data: evts }, { data: otherRows }] = await Promise.all([
      supabase.from('invoice_events').select('*').eq('invoice_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('invoices').select('id,supplier,invoice_number,invoice_date,total').neq('id', id).limit(500),
    ]);
    setEvents(evts || []);
    setOthers(otherRows || []);

    // Preview: download private file, show as object URL
    try {
      if (inv.file_path) {
        const { data: blob, error: dlErr } = await supabase.storage.from('invoices').download(inv.file_path);
        if (!dlErr && blob) {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setPreviewKind(blob.type === 'application/pdf' ? 'pdf' : 'image');
        }
      }
    } catch {
      // preview optional
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const duplicates = useMemo(() => {
    if (!invoice) return { isPossibleDuplicate: false, matches: [] };
    return findDuplicates(
      {
        supplier: invoice.supplier,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        total: invoice.total,
      },
      others,
      invoice.id,
    );
  }, [invoice, others]);

  const flags = useMemo(() => {
    const fromAi = Array.isArray(invoice?.ai_extraction?.validation_flags) ? invoice.ai_extraction.validation_flags : [];
    const merged = new Set(fromAi);
    if (duplicates.isPossibleDuplicate) merged.add('POSSIBLE_DUPLICATE');
    return [...merged];
  }, [invoice, duplicates]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setLine(idx, key, value) {
    setLines((prev) => prev.map((li, i) => (i === idx ? { ...li, [key]: value } : li)));
  }

  async function logEvent(eventType, metadata = {}) {
    await supabase.from('invoice_events').insert({
      invoice_id: id,
      user_id: user.id,
      event_type: eventType,
      metadata,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (form.invoice_date && !isValidDate(form.invoice_date)) throw new Error('Invoice date must be YYYY-MM-DD.');
      if (form.due_date && !isValidDate(form.due_date)) throw new Error('Due date must be YYYY-MM-DD.');
      const payload = {
        supplier: form.supplier.trim(),
        invoice_number: form.invoice_number.trim(),
        invoice_date: form.invoice_date || null,
        due_date: form.due_date || null,
        currency: form.currency.trim().toUpperCase().slice(0, 3),
        subtotal: form.subtotal === '' ? null : toNumberOrNull(form.subtotal),
        tax: form.tax === '' ? null : toNumberOrNull(form.tax),
        tax_rate: form.tax_rate === '' ? null : toNumberOrNull(form.tax_rate),
        total: form.total === '' ? null : toNumberOrNull(form.total),
        purchase_order: form.purchase_order.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
      };
      const { error: upErr } = await supabase.from('invoices').update(payload).eq('id', id);
      if (upErr) throw new Error(upErr.message);

      // Replace line items
      const { error: delErr } = await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
      if (delErr) throw new Error(delErr.message);
      const rows = lines
        .filter((li) => (li.description || '').trim() !== '' || li.total !== '' || li.unit_price !== '')
        .map((li) => ({
          invoice_id: id,
          description: (li.description || '').trim(),
          quantity: li.quantity === '' ? null : toNumberOrNull(li.quantity),
          unit_price: li.unit_price === '' ? null : toNumberOrNull(li.unit_price),
          tax: li.tax === '' ? null : toNumberOrNull(li.tax),
          total: li.total === '' ? null : toNumberOrNull(li.total),
        }));
      if (rows.length) {
        const { error: insErr } = await supabase.from('invoice_line_items').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
      await logEvent('updated', { fields: Object.keys(payload) });
      setNotice('Changes saved.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status) {
    setSaving(true);
    setError('');
    try {
      const { error: upErr } = await supabase.from('invoices').update({ status }).eq('id', id);
      if (upErr) throw new Error(upErr.message);
      await logEvent(status === 'approved' ? 'approved' : 'rejected', { confidence: invoice.confidence });
      setNotice(status === 'approved' ? 'Invoice approved.' : 'Invoice rejected.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReprocess() {
    if (!invoice?.file_path) {
      setError('No original file stored for this invoice — upload it again to reprocess.');
      return;
    }
    setReprocessing(true);
    setError('');
    setNotice('');
    const started = Date.now();
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from('invoices').download(invoice.file_path);
      if (dlErr || !blob) throw new Error('Could not download the original file.');
      const file = new File([blob], invoice.original_filename || 'invoice', { type: blob.type });
      await supabase.from('invoices').update({ status: 'processing' }).eq('id', id);
      const { processFileForOcr } = await import('../utils/ocr.js');
      const ocr = await processFileForOcr(file, {});
      const result = await processInvoice({
        ocrText: ocr.ocrText,
        imageBase64: ocr.multimodalBase64,
        mimeType: ocr.mimeType,
        filename: invoice.original_filename || '',
        ocrConfidence: ocr.ocrConfidence,
      });
      const extraction = result.extraction;
      await supabase
        .from('invoices')
        .update({
          supplier: extraction.supplier || '',
          invoice_number: extraction.invoice_number || '',
          invoice_date: extraction.invoice_date || null,
          due_date: extraction.due_date || null,
          currency: extraction.currency || '',
          subtotal: extraction.subtotal,
          tax: extraction.tax,
          tax_rate: extraction.tax_rate,
          total: extraction.total,
          purchase_order: extraction.purchase_order,
          payment_terms: extraction.payment_terms,
          raw_ocr_text: ocr.ocrText,
          ai_extraction: extraction,
          confidence: extraction.confidence || 0,
          status: 'needs_review',
        })
        .eq('id', id);
      await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
      if (Array.isArray(extraction.line_items) && extraction.line_items.length) {
        await supabase.from('invoice_line_items').insert(
          extraction.line_items.map((li) => ({
            invoice_id: id,
            description: li.description || '',
            quantity: li.quantity,
            unit_price: li.unit_price,
            tax: li.tax,
            total: li.total,
          })),
        );
      }
      await supabase.from('invoice_processing_runs').insert({
        invoice_id: id,
        processing_type: 'reprocess',
        status: 'succeeded',
        duration_ms: Date.now() - started,
      });
      await logEvent('reprocessed', { ocrConfidence: ocr.ocrConfidence });
      setNotice('Reprocessing complete — review the updated fields.');
      await load();
    } catch (err) {
      setError(err.message || 'Reprocessing failed');
      await supabase.from('invoice_processing_runs').insert({
        invoice_id: id,
        processing_type: 'reprocess',
        status: 'failed',
        duration_ms: Date.now() - started,
        error_message: String(err.message || err).slice(0, 2000),
      });
    } finally {
      setReprocessing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this invoice and its line items? This cannot be undone.')) return;
    const { error: delErr } = await supabase.from('invoices').delete().eq('id', id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    try {
      if (invoice?.file_path) await supabase.storage.from('invoices').remove([invoice.file_path]);
    } catch {
      // ignore storage cleanup errors
    }
    navigate('/invoices');
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading invoice">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-10 w-2/3" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="skeleton h-96" />
          <div className="skeleton h-96" />
        </div>
      </div>
    );
  }
  if (!invoice) return <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error || 'Not found'}</p>;

  return (
    <div className="space-y-5">
      <div className="border-b pb-5" style={{ borderColor: '#e5ddc6' }}>
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 hover:text-brand-800">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13 8H3M8 4.5 4.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Folio · {invoice.id.slice(0, 8)}</p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink-900">{invoice.supplier || 'Untitled invoice'}</h1>
            <p className="tnum mt-1 font-mono text-xs text-ink-500">{invoice.invoice_number || 'no number'} · {formatDate(invoice.invoice_date)}</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-white px-3 py-2 shadow-ledger" style={{ borderColor: '#e5ddc6' }}>
            <StatusBadge status={invoice.status} />
            <span className="h-5 w-px bg-paper-300" aria-hidden="true" />
            <ConfidenceBar value={invoice.confidence} />
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-brand-700/30 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">{notice}</p> : null}

      {duplicates.isPossibleDuplicate ? (
        <div className="rounded-xl border-2 border-double border-brass-600/60 bg-brass-50 p-4 text-sm text-ink-800">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brass-700">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.8 14.8 13.5H1.2L8 1.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 6v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
            </svg>
            Possible duplicate detected
          </p>
          <p className="mt-1.5">
            Matches:{' '}
            {duplicates.matches.map((m) => (
              <Link key={m.invoice.id} to={`/invoices/${m.invoice.id}`} className="ml-1 font-semibold text-brand-800 underline decoration-brass-600 decoration-2 underline-offset-2">
                {m.invoice.supplier} {m.invoice.invoice_number} ({m.reasons.join(', ')})
              </Link>
            ))}
            <span className="ml-1 text-ink-600">Nothing was deleted — approve only if this is genuinely distinct.</span>
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card h-fit p-5">
          <p className="eyebrow">Evidence</p>
          <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">Original file</h2>
          <div className="mt-3">
            {!previewUrl ? (
              <p className="rounded-lg border border-dashed border-paper-400 bg-paper-50 px-3 py-6 text-center text-sm text-ink-500">No preview available (file not stored or still uploading).</p>
            ) : previewKind === 'pdf' ? (
              <iframe title="Invoice PDF" src={previewUrl} className="h-[560px] w-full rounded-lg border bg-white" style={{ borderColor: '#e5ddc6' }} />
            ) : (
              <img src={previewUrl} alt="Invoice scan" className="max-h-[560px] w-full rounded-lg border bg-white object-contain" style={{ borderColor: '#e5ddc6' }} />
            )}
          </div>
          <div className="mt-4">
            <h3 className="label">Raw OCR text</h3>
            <pre className="mono-box max-h-56 whitespace-pre-wrap">{invoice.raw_ocr_text || '(no OCR text saved)'}</pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="eyebrow">Examination</p>
            <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">Validation</h2>
            <div className="mt-2">
              <ValidationFlags flags={flags} />
            </div>
            <div className="tnum mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-sm" style={{ borderColor: '#e5ddc6' }}>
              <div><span className="text-ink-500">Total:</span> <strong className="text-ink-900">{formatMoney(invoice.total, invoice.currency)}</strong></div>
              <div><span className="text-ink-500">Created:</span> <span className="text-ink-800">{formatDateTime(invoice.created_at)}</span></div>
            </div>
          </div>

          <div className="card space-y-3 p-5">
            <div>
              <p className="eyebrow">Ledger entry</p>
              <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">Extracted fields (editable)</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Supplier</label>
                <input className="input" value={form.supplier} onChange={(e) => setField('supplier', e.target.value)} />
              </div>
              <div>
                <label className="label">Invoice number</label>
                <input className="input font-mono" value={form.invoice_number} onChange={(e) => setField('invoice_number', e.target.value)} />
              </div>
              <div>
                <label className="label">Currency (ISO)</label>
                <input className="input" value={form.currency} onChange={(e) => setField('currency', e.target.value)} placeholder="USD" />
              </div>
              <div>
                <label className="label">Invoice date</label>
                <input className="input tnum" type="date" value={form.invoice_date} onChange={(e) => setField('invoice_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Due date</label>
                <input className="input tnum" type="date" value={form.due_date} onChange={(e) => setField('due_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Subtotal</label>
                <input className="input tnum" type="number" step="0.01" value={form.subtotal} onChange={(e) => setField('subtotal', e.target.value)} />
              </div>
              <div>
                <label className="label">Tax</label>
                <input className="input tnum" type="number" step="0.01" value={form.tax} onChange={(e) => setField('tax', e.target.value)} />
              </div>
              <div>
                <label className="label">Tax rate %</label>
                <input className="input tnum" type="number" step="0.01" value={form.tax_rate} onChange={(e) => setField('tax_rate', e.target.value)} />
              </div>
              <div>
                <label className="label">Total</label>
                <input className="input tnum" type="number" step="0.01" value={form.total} onChange={(e) => setField('total', e.target.value)} />
              </div>
              <div>
                <label className="label">Purchase order</label>
                <input className="input" value={form.purchase_order} onChange={(e) => setField('purchase_order', e.target.value)} />
              </div>
              <div>
                <label className="label">Payment terms</label>
                <input className="input" value={form.payment_terms} onChange={(e) => setField('payment_terms', e.target.value)} />
              </div>
            </div>

            <div>
              <h3 className="label">Line items</h3>
              <div className="space-y-2">
                {lines.map((li, idx) => (
                  <div key={li.id || idx} className="grid grid-cols-12 gap-2">
                    <input className="input col-span-5" placeholder="Description" value={li.description || ''} onChange={(e) => setLine(idx, 'description', e.target.value)} />
                    <input className="input tnum col-span-2" type="number" step="any" placeholder="Qty" value={li.quantity ?? ''} onChange={(e) => setLine(idx, 'quantity', e.target.value)} />
                    <input className="input tnum col-span-2" type="number" step="any" placeholder="Unit" value={li.unit_price ?? ''} onChange={(e) => setLine(idx, 'unit_price', e.target.value)} />
                    <input className="input tnum col-span-2" type="number" step="any" placeholder="Total" value={li.total ?? ''} onChange={(e) => setLine(idx, 'total', e.target.value)} />
                    <button className="btn-secondary col-span-1 !px-2" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))} title="Remove line" aria-label="Remove line">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn-secondary mt-2 !px-3 !py-1.5 text-xs" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                + Add line
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: '#e5ddc6' }}>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              <button className="btn-secondary" onClick={handleReprocess} disabled={reprocessing || saving}>
                {reprocessing ? 'Reprocessing…' : 'Reprocess'}
              </button>
              {invoice.status !== 'approved' ? (
                <button className="btn-primary !border-brand-900 !bg-brand-700 hover:!bg-brand-800" onClick={() => setStatus('approved')} disabled={saving}>Approve</button>
              ) : null}
              {invoice.status !== 'rejected' ? (
                <button className="btn-danger" onClick={() => setStatus('rejected')} disabled={saving}>Reject</button>
              ) : null}
              <button className="btn-secondary !border-red-800/30 !text-red-700 hover:!bg-red-50" onClick={handleDelete} disabled={saving}>Delete</button>
            </div>
          </div>

          <div className="card p-5">
            <p className="eyebrow">Machine record</p>
            <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">AI extraction JSON</h2>
            <pre className="mono-box mt-2 max-h-72">{JSON.stringify(invoice.ai_extraction || {}, null, 2)}</pre>
          </div>

          <div className="card p-5">
            <p className="eyebrow">Chronicle</p>
            <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">Activity</h2>
            {events.length === 0 ? (
              <p className="mt-1 text-sm text-ink-500">No events yet.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-2 border-b pb-1.5" style={{ borderColor: '#ece5d0' }}>
                    <span className="font-mono text-xs font-semibold text-brand-800">{ev.event_type}</span>
                    <span className="tnum text-xs text-ink-500">{formatDateTime(ev.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
