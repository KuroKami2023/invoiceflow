import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import UploadDropzone from '../components/UploadDropzone.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { validateFile } from '../utils/validation.js';
import { findDuplicates } from '../utils/duplicate.js';
// NOTE: ../utils/ocr.js (Tesseract + PDF.js) is dynamically imported inside runJob
// so the heavy OCR libraries load only when processing starts, not on page load.
import { processInvoice } from '../lib/api.js';
import { MAX_FILES_PER_BATCH } from '../utils/constants.js';

function newJob(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    stage: 'queued', // queued → uploading → ocr → ai → saving → done | error
    progress: 0,
    message: 'Queued',
    invoiceId: null,
    error: '',
  };
}

export default function Upload() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [existing, setExisting] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('invoices')
      .select('id,supplier,invoice_number,invoice_date,total')
      .then(({ data }) => setExisting(data || []));
  }, []);

  function patchJob(id, patch) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function handleFiles(files) {
    const batch = files.slice(0, MAX_FILES_PER_BATCH);
    const additions = [];
    for (const file of batch) {
      const v = validateFile(file);
      if (!v.ok) {
        additions.push({ ...newJob(file), stage: 'error', error: v.error, message: 'Rejected' });
      } else {
        additions.push(newJob(file));
      }
    }
    setJobs((prev) => [...additions, ...prev].slice(0, 30));
  }

  async function logRun(invoiceId, processingType, status, durationMs, errorMessage) {
    try {
      await supabase.from('invoice_processing_runs').insert({
        invoice_id: invoiceId,
        processing_type: processingType,
        status,
        duration_ms: durationMs,
        error_message: errorMessage ? String(errorMessage).slice(0, 2000) : null,
      });
    } catch {
      // non-fatal
    }
  }

  async function logEvent(invoiceId, eventType, metadata = {}) {
    try {
      await supabase.from('invoice_events').insert({
        invoice_id: invoiceId,
        user_id: user.id,
        event_type: eventType,
        metadata,
      });
    } catch {
      // non-fatal
    }
  }

  async function runJob(job) {
    const started = Date.now();
    let invoiceId = null;
    try {
      // 1. Create invoice row (processing) so we have an id for the storage path
      patchJob(job.id, { stage: 'uploading', progress: 5, message: 'Creating record…' });
      const { data: created, error: createErr } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          original_filename: job.file.name,
          status: 'processing',
          confidence: 0,
          ai_extraction: {},
        })
        .select('id')
        .single();
      if (createErr) throw new Error(createErr.message);
      invoiceId = created.id;
      patchJob(job.id, { invoiceId });

      // 2. Store original in Supabase Storage: invoices/<uid>/<invoiceId>/<filename>
      patchJob(job.id, { progress: 15, message: 'Uploading original…' });
      const safeName = job.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${invoiceId}/${safeName}`;
      const { error: upErr } = await supabase.storage.from('invoices').upload(storagePath, job.file, {
        contentType: job.file.type,
        upsert: true,
      });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
      await supabase.from('invoices').update({ file_path: storagePath }).eq('id', invoiceId);

      // 3. OCR (Tesseract + PDF.js, OpenCV preprocessing when available)
      patchJob(job.id, { stage: 'ocr', progress: 30, message: 'Loading OCR engine…' });
      const { processFileForOcr } = await import('../utils/ocr.js');
      const ocr = await processFileForOcr(job.file, {
        onProgress: ({ status, progress }) => {
          patchJob(job.id, { message: status || 'Running OCR…', progress: 30 + Math.round((progress || 0) * 30) });
        },
      });

      // 4. AI extraction (server-side NVIDIA call)
      patchJob(job.id, { stage: 'ai', progress: 65, message: 'Extracting with AI…' });
      let extraction;
      let aiOk = true;
      try {
        const result = await processInvoice({
          ocrText: ocr.ocrText,
          imageBase64: ocr.multimodalBase64,
          mimeType: ocr.mimeType,
          filename: job.file.name,
          ocrConfidence: ocr.ocrConfidence,
        });
        extraction = result.extraction;
      } catch (aiErr) {
        aiOk = false;
        // Graceful degradation: keep OCR text, flag for manual review
        extraction = {
          supplier: '',
          invoice_number: '',
          invoice_date: '',
          due_date: null,
          currency: '',
          subtotal: null,
          tax: null,
          tax_rate: null,
          total: null,
          purchase_order: null,
          payment_terms: null,
          line_items: [],
          confidence: 0,
          validation_flags: ['AI_EXTRACTION_UNCERTAIN'],
        };
        patchJob(job.id, { message: `AI unavailable (${aiErr.message}) — saved OCR for manual review` });
        await logRun(invoiceId, 'ai_extraction', 'failed', Date.now() - started, aiErr.message);
      }

      // 5. Duplicate warning (never auto-delete)
      const dup = findDuplicates(
        {
          supplier: extraction.supplier,
          invoice_number: extraction.invoice_number,
          invoice_date: extraction.invoice_date,
          total: extraction.total,
        },
        existing,
        invoiceId,
      );
      const flags = new Set(extraction.validation_flags || []);
      if (dup.isPossibleDuplicate) flags.add('POSSIBLE_DUPLICATE');
      if (typeof ocr.ocrConfidence === 'number' && ocr.ocrConfidence < 60) flags.add('OCR_UNCERTAIN');
      extraction.validation_flags = [...flags];

      // 6. Persist
      patchJob(job.id, { stage: 'saving', progress: 90, message: 'Saving…' });
      const { error: updateErr } = await supabase
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
        .eq('id', invoiceId);
      if (updateErr) throw new Error(updateErr.message);

      if (Array.isArray(extraction.line_items) && extraction.line_items.length) {
        const rows = extraction.line_items.map((li) => ({
          invoice_id: invoiceId,
          description: li.description || '',
          quantity: li.quantity,
          unit_price: li.unit_price,
          tax: li.tax,
          total: li.total,
        }));
        await supabase.from('invoice_line_items').insert(rows);
      }
      if (aiOk) await logRun(invoiceId, 'ai_extraction', 'succeeded', Date.now() - started, null);
      await logEvent(invoiceId, 'processed', {
        ocrConfidence: ocr.ocrConfidence,
        preprocessMethod: ocr.preprocessMethod,
        pages: ocr.pages,
        possibleDuplicate: dup.isPossibleDuplicate,
      });

      setExisting((prev) => [
        ...prev,
        {
          id: invoiceId,
          supplier: extraction.supplier,
          invoice_number: extraction.invoice_number,
          invoice_date: extraction.invoice_date,
          total: extraction.total,
        },
      ]);
      patchJob(job.id, { stage: 'done', progress: 100, message: 'Ready for review', error: '' });
    } catch (err) {
      const message = err.message || 'Processing failed';
      patchJob(job.id, { stage: 'error', message: 'Failed', error: message });
      if (invoiceId) {
        await logRun(invoiceId, 'ai_extraction', 'failed', Date.now() - started, message);
        await supabase.from('invoices').update({ status: 'needs_review' }).eq('id', invoiceId);
      }
    }
  }

  async function processAll() {
    const queued = jobs.filter((j) => j.stage === 'queued');
    if (!queued.length || busy) return;
    setBusy(true);
    try {
      // Sequential keeps OCR/AI memory + rate limits predictable on free tiers
      for (const job of queued) {
        // eslint-disable-next-line no-await-in-loop
        await runJob(job);
      }
    } finally {
      setBusy(false);
    }
  }

  const queuedCount = jobs.filter((j) => j.stage === 'queued').length;

  return (
    <div className="space-y-5">
      <div className="border-b pb-5" style={{ borderColor: '#e5ddc6' }}>
        <p className="eyebrow">Intake desk</p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink-900">Upload invoices</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
          PDF, PNG, JPG, or JPEG. Files are stored privately, OCR runs in your browser, and AI extraction runs
          server-side.
        </p>
      </div>

      <UploadDropzone onFiles={handleFiles} disabled={busy} />

      {jobs.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: '#e5ddc6' }}>
            <div>
              <p className="eyebrow">Batch manifest</p>
              <h2 className="font-serif text-lg font-bold text-ink-900">Batch ({jobs.length})</h2>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !px-3 !py-1.5" onClick={() => setJobs([])} disabled={busy}>
                Clear
              </button>
              <button className="btn-primary !px-3 !py-1.5" onClick={processAll} disabled={busy || queuedCount === 0}>
                {busy ? 'Processing…' : `Process ${queuedCount} file${queuedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id} className="ledger-row rounded-lg border bg-paper-50 p-3" style={{ borderColor: '#e5ddc6' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{job.file.name}</p>
                    <p className="tnum text-xs text-ink-500">
                      {(job.file.size / 1024).toFixed(0)} KB · {job.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.stage === 'done' && job.invoiceId ? (
                      <Link to={`/invoices/${job.invoiceId}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 underline decoration-brass-600 decoration-2 underline-offset-4 hover:text-brand-800">
                        Review
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    ) : null}
                    {job.stage !== 'done' && job.stage !== 'error' ? (
                      <StatusBadge status={job.stage === 'queued' ? 'uploaded' : 'processing'} />
                    ) : null}
                    {job.stage === 'done' ? <StatusBadge status="needs_review" /> : null}
                    {job.stage === 'error' && !job.invoiceId ? (
                      <span className="stamp inline-flex items-center rounded-[5px] border-2 border-double border-red-800/50 bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase text-red-800">Rejected</span>
                    ) : null}
                  </div>
                </div>
                {job.stage !== 'queued' && job.stage !== 'error' ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full border bg-paper-200" style={{ borderColor: '#e5ddc6' }}>
                    <div className="h-full rounded-full bg-brand-700 transition-all duration-300" style={{ width: `${job.progress}%` }} />
                  </div>
                ) : null}
                {job.error ? <p className="mt-2 text-xs font-medium text-red-700">{job.error}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
