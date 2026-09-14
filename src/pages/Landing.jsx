import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useReveal } from '../hooks/useReveal.js';

/* Scroll-reveal wrapper (styling: .reveal / .reveal.is-visible in index.css). */
function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const [ref, visible] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* Pointer driven 3D tilt. Writes CSS vars directly, no rerenders. */
function useTilt(max = 7) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return { ref, onMove, onLeave };
}

/* ---------- inline SVG icons (stroke, currentColor) ---------- */

function IconScan() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 10h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5c.6 3.4 2.1 5 5.5 5.6-3.4.6-4.9 2.2-5.5 5.6-.6-3.4-2.1-5-5.5-5.6 3.4-.6 4.9-2.2 5.5-5.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15.5 13.5c.3 1.5.9 2.2 2.4 2.5-1.5.3-2.1 1-2.4 2.5-.3-1.5-.9-2.2-2.4-2.5 1.5-.3 2.1-1 2.4-2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 17V3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 4.5h9.5l-2 3.5 2 3.5H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="6.5" y="6.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.5 6.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" transform="translate(1 1)" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7 10.2 2.2 2.2L13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14M8.5 8v8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- content (verified against src/utils + pages) ---------- */

const FEATURES = [
  {
    icon: <IconScan />,
    title: 'In-browser OCR pipeline',
    body: 'Photos and scans are read right in your browser (Tesseract.js, with PDF page rendering). PDF, PNG, JPG, or JPEG up to 10 MB, up to 10 files per batch. Nothing to install.',
  },
  {
    icon: <IconSpark />,
    title: 'AI extraction with confidence',
    body: 'A Nemotron vision model pulls supplier, number, dates, currency, amounts, and line items from the OCR text plus the page image, and scores itself 0 to 100. Below 60 means verify every field.',
  },
  {
    icon: <IconFlag />,
    title: 'Validation flags, not silent edits',
    body: 'Missing supplier, number, date, or total, invalid dates, total mismatches, and low confidence are surfaced as explicit flags. You correct them. The app never rewrites your numbers.',
  },
  {
    icon: <IconCopy />,
    title: 'Duplicate detection',
    body: 'Each invoice is scored against your ledger on supplier, invoice number, date, and total. Matches raise a possible duplicate flag with links. Nothing is ever auto-deleted.',
  },
  {
    icon: <IconCheck />,
    title: 'Approve and reject with an event log',
    body: 'Review the original file next to the extracted fields, edit anything, then approve or reject. Every action is written to a per-invoice activity record.',
  },
  {
    icon: <IconTable />,
    title: 'Line items, CSV export and demo data',
    body: 'Line items are stored per invoice and editable. Export your ledger to CSV (or JSON) any time. Not ready to upload? Load a synthetic demo dataset and try the full workflow first.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Upload',
    body: 'Drop in a photo or scan: PDF, PNG, JPG, JPEG. The original file is stored privately under your account.',
  },
  {
    n: '02',
    title: 'OCR',
    body: 'Text is recognized in your browser, page by page for PDFs, with a quality score attached to the run.',
  },
  {
    n: '03',
    title: 'AI extract and validate',
    body: 'Nemotron extracts fields and line items server-side, then validation flags anything missing, mismatched, or low-confidence.',
  },
  {
    n: '04',
    title: 'Review, approve, export',
    body: 'Compare against the original, fix what needs fixing, approve or reject, then export clean CSV for your books.',
  },
];

const FAQS = [
  {
    q: 'Where do my files go?',
    a: 'Your originals are stored in private per-account storage, and every invoice row belongs to your user id, so other accounts cannot see it. OCR runs locally in your browser; only the OCR text and a compressed page image are sent to the server for AI extraction. The AI provider key stays server-side and is never bundled into the app.',
  },
  {
    q: 'What if OCR misreads a total?',
    a: 'That is exactly what the validation layer is for. A low OCR score marks the invoice uncertain, arithmetic that does not add up raises a mismatch flag, and anything under 60 confidence tells you to verify every field. All fields are editable, the raw OCR text stays attached for comparison, and you can reprocess the original at any point.',
  },
  {
    q: 'Does it handle my currency and language?',
    a: 'Honestly, with limits. The OCR engine reads English, so non-English scans need careful review. Currency is stored exactly as extracted (a 3-letter ISO code like USD, EUR, or GBP) and formatted accordingly. Amounts are never converted between currencies. If your documents are mostly non-English, review each extraction closely before relying on it.',
  },
  {
    q: 'Do I need an account?',
    a: 'Yes. Your ledger is private to your account, so uploading, reviewing, and even loading the synthetic demo dataset all require signing in. There is no public upload or shared workspace.',
  },
  {
    q: 'Does it integrate with my accounting software?',
    a: 'No. There is no QuickBooks, Xero, or other accounting integration. Export is CSV (plus JSON) that you import wherever you keep your books. If you need a live sync, this is not that tool.',
  },
];

/* ---------- page ---------- */

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-brand-800 font-serif text-sm font-bold text-paper-100 ring-1 ring-brass-600 ring-offset-1 ring-offset-paper-100">
        <span aria-hidden="true" className="absolute inset-1 rounded-[4px] border border-brass-500/60" />
        <span className="relative">IF</span>
      </span>
      <span className="leading-none">
        <span className="block font-serif text-[17px] font-bold tracking-tight text-ink-900">
          InvoiceFlow
        </span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.22em] text-brass-600">
          Private Ledger
        </span>
      </span>
    </span>
  );
}

function LedgerVisual() {
  const { ref, onMove, onLeave } = useTilt(7);
  return (
    <div className="if-tilt-scene" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={ref} className="if-tilt relative">
        <div className="if-orb" aria-hidden="true" />
        <figure className="relative overflow-hidden rounded-2xl border border-white/15 shadow-ledger-lg">
          <img
            src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200&auto=format&fit=crop"
            alt="A calculator and tax forms on a ledger desk"
            width="880"
            height="620"
            loading="eager"
            className="aspect-[880/620] w-full object-cover"
          />
          <span className="if-shine" aria-hidden="true" />
        </figure>
        <figure className="if-float-slow relative z-10 mx-4 -mt-10 ml-auto w-3/5 overflow-hidden rounded-xl border border-white/15 shadow-ledger-lg md:mx-6">
          <img
            src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=800&auto=format&fit=crop"
            alt="A card payment being recorded"
            width="560"
            height="380"
            loading="lazy"
            className="aspect-[560/380] w-full object-cover"
          />
        </figure>
        <figcaption className="mt-3 text-right text-[12.5px] italic leading-relaxed text-paper-200/70">
          Approved only by you, never by the machine.
        </figcaption>
      </div>
    </div>
  );
}

function FeatureCard({ f }) {
  return (
    <article className="card h-full p-5">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brass-600/40 bg-brass-50 text-brass-600">
        {f.icon}
      </span>
      <h3 className="mt-3 font-serif text-lg font-bold text-ink-900">{f.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.body}</p>
    </article>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);

  const primaryTo = user ? '/dashboard' : '/register';
  const primaryLabel = user ? 'Open ledger' : 'Get started';

  return (
    <div className="min-h-screen">
      <div className="h-1 w-full bg-brand-800" aria-hidden="true">
        <div className="mx-auto h-full max-w-6xl px-4">
          <div className="h-full w-24 bg-brass-600" aria-hidden="true" />
        </div>
      </div>

      <header className="sticky top-0 z-20 border-b bg-paper-50/95 backdrop-blur" style={{ borderColor: '#e5ddc6' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <a href="#top" aria-label="InvoiceFlow home">
            <Wordmark />
          </a>
          <nav className="order-3 flex w-full items-center gap-1 sm:order-2 sm:w-auto" aria-label="Page sections">
            <a href="#features" className="rounded-md px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-paper-200 hover:text-brand-800">Features</a>
            <a href="#pipeline" className="rounded-md px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-paper-200 hover:text-brand-800">Pipeline</a>
            <a href="#faq" className="rounded-md px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-paper-200 hover:text-brand-800">FAQ</a>
          </nav>
          <div className="order-2 flex items-center gap-2 sm:order-3">
            {user ? (
              <Link to="/dashboard" className="btn-primary !px-3 !py-1.5 !text-[13px]">
                Open ledger <IconArrow />
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-ink-600 transition-colors hover:bg-paper-200 hover:text-brand-800">
                  Sign in
                </Link>
                <Link to="/register" className="btn-primary !px-3 !py-1.5 !text-[13px]">
                  Get started <IconArrow />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b bg-brand-900" style={{ borderColor: '#0e3320' }}>
          <div className="if-hero-mesh" aria-hidden="true" />
          <div className="bank-lines">
            <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-12 lg:grid-cols-2 lg:pb-20 lg:pt-16">
              <Reveal>
                <h1 className="font-serif text-4xl font-bold leading-[1.08] tracking-tight text-paper-50 sm:text-5xl">
                  Every invoice, entered in the ledger. Checked, not guessed.
                </h1>
                <div className="rule-brass mt-5 w-16" aria-hidden="true" />
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-paper-200">
                  Photograph invoices, read them with in-browser OCR, and extract fields with AI review. Flags catch uncertainty, CSV is one click.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to={primaryTo} className="btn-primary !px-5 !py-2.5 !text-[15px]">
                    {primaryLabel} <IconArrow />
                  </Link>
                  <Link to={user ? '/demo' : '/register'} className="btn-secondary !px-5 !py-2.5 !text-[15px]">
                    Try the demo dataset
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <LedgerVisual />
              </Reveal>
            </div>
          </div>
        </section>

        <section className="border-b bg-paper-50" style={{ borderColor: '#e5ddc6' }} aria-label="At a glance">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <Reveal>
              <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {[
                  ['Private to your account', 'Originals and rows stay inside your login.'],
                  ['Unknowns stay empty', 'The AI never invents line items or totals.'],
                  ['Demo data is fictional', 'Six sample invoices, free account to try.'],
                ].map(([term, def]) => (
                  <div key={term} className="flex items-baseline gap-3">
                    <span className="h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full bg-brass-600" aria-hidden="true" />
                    <div>
                      <dt className="font-serif text-[15px] font-bold text-ink-900">{term}</dt>
                      <dd className="text-[13px] text-ink-500">{def}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        <section id="features" className="scroll-mt-24">
          <div className="mx-auto max-w-6xl px-4 py-14 lg:py-20">
            <Reveal>
              <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-900">Six capabilities, each one reviewable</h2>
              <div className="rule-brass mt-4 w-12" aria-hidden="true" />
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">
                Everything below exists in the app today. Upload a file or load the demo set.
              </p>
            </Reveal>
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Reveal className="md:col-span-2">
                <article className="card grid h-full gap-5 overflow-hidden p-0 sm:grid-cols-2">
                  <img
                    src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=900&auto=format&fit=crop"
                    alt="Reviewing business documents at a laptop"
                    width="640"
                    height="440"
                    loading="lazy"
                    className="h-48 w-full object-cover sm:h-full"
                  />
                  <div className="flex flex-col p-5 pl-1 pr-6 sm:py-6">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brass-600/40 bg-brass-50 text-brass-600">
                      {FEATURES[0].icon}
                    </span>
                    <h3 className="mt-3 font-serif text-[19px] font-bold text-ink-900">{FEATURES[0].title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-600">{FEATURES[0].body}</p>
                  </div>
                </article>
              </Reveal>
              <Reveal delay={80}>
                <FeatureCard f={FEATURES[1]} />
              </Reveal>
              <Reveal>
                <FeatureCard f={FEATURES[2]} />
              </Reveal>
              <Reveal delay={80}>
                <FeatureCard f={FEATURES[3]} />
              </Reveal>
              <Reveal delay={160}>
                <FeatureCard f={FEATURES[4]} />
              </Reveal>
              <Reveal className="md:col-span-3">
                <article className="card grid h-full items-center gap-5 p-5 sm:grid-cols-[1.2fr_1fr]">
                  <div>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-brass-600/40 bg-brass-50 text-brass-600">
                      {FEATURES[5].icon}
                    </span>
                    <h3 className="mt-3 font-serif text-[19px] font-bold text-ink-900">{FEATURES[5].title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{FEATURES[5].body}</p>
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=900&auto=format&fit=crop"
                    alt="Exporting clean rows on a laptop"
                    width="640"
                    height="360"
                    loading="lazy"
                    className="aspect-[640/360] w-full rounded-xl border object-cover"
                    style={{ borderColor: '#e5ddc6' }}
                  />
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="pipeline" className="scroll-mt-24 border-y bg-paper-50" style={{ borderColor: '#e5ddc6' }}>
          <div className="mx-auto max-w-6xl px-4 py-14 lg:py-20">
            <Reveal>
              <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-900">Four steps, one human in the loop</h2>
              <div className="rule-brass mt-4 w-12" aria-hidden="true" />
            </Reveal>
            <ol className="mt-8 divide-y border-y" style={{ borderColor: '#e5ddc6' }}>
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 60}>
                  <li className="flex gap-5 py-5">
                    <span className="tnum font-mono text-xs font-bold tracking-[0.18em] text-brass-600" aria-hidden="true">{s.n}</span>
                    <div>
                      <h3 className="font-serif text-lg font-bold text-ink-900">{s.title}</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">{s.body}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
            <Reveal>
              <p className="tnum mt-6 text-xs text-ink-500">
                Accepted inputs: PDF, PNG, JPG, JPEG. Max 10 MB per file. OCR quality and processing runs are recorded per invoice.
              </p>
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24">
          <div className="mx-auto max-w-3xl px-4 py-14 lg:py-20">
            <Reveal>
              <h2 className="font-serif text-3xl font-bold tracking-tight text-ink-900">Frequently asked questions</h2>
              <div className="rule-brass mt-4 w-12" aria-hidden="true" />
            </Reveal>
            <div className="mt-8 space-y-3">
              {FAQS.map((f, i) => {
                const open = openFaq === i;
                return (
                  <Reveal key={f.q} delay={i * 40}>
                    <div className="card-flat overflow-hidden !rounded-xl">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? -1 : i)}
                        aria-expanded={open}
                        aria-controls={`faq-panel-${i}`}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-paper-100"
                      >
                        <span className="font-serif text-[17px] font-bold text-ink-900">{f.q}</span>
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-transform duration-200 ${open ? 'rotate-45 border-brand-700 bg-brand-600 text-white' : 'border-paper-400 bg-white text-brand-800'}`}
                          aria-hidden="true"
                        >
                          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </span>
                      </button>
                      <div id={`faq-panel-${i}`} hidden={!open}>
                        <p className="border-t px-5 py-4 text-sm leading-relaxed text-ink-600" style={{ borderColor: '#ece5d0' }}>
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-brand-900" aria-label="Get started">
          <div className="mx-auto max-w-6xl px-4 py-14 text-center lg:py-16">
            <Reveal>
              <h2 className="mx-auto max-w-2xl font-serif text-3xl font-bold tracking-tight text-paper-50">
                Start with the demo set. Stay for the clean ledger.
              </h2>
              <div className="rule-brass mx-auto mt-5 w-12" aria-hidden="true" />
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-paper-200">
                Sign up, load six fictional invoices, approve one, reject one, export the CSV.
                Then bring your own scans.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to={primaryTo} className="btn-primary !px-5 !py-2.5 !text-[15px]">
                  {primaryLabel} <IconArrow />
                </Link>
                <Link to="/login" className="btn-secondary !px-5 !py-2.5 !text-[15px]">
                  Sign in
                </Link>
              </div>
            </Reveal>
          </div>
          <footer className="border-t border-white/10">
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-paper-200/70">
                <span className="inline-block h-px w-8 bg-brass-600" aria-hidden="true" />
                InvoiceFlow, Private Ledger
                <span className="inline-block h-px w-8 bg-brass-600" aria-hidden="true" />
              </div>
              <p className="text-xs text-paper-200/60">AI plus OCR invoice extraction with human review. CSV export, no accounting sync.</p>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
