import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function AuthBrandPanel({ title, body }) {
  return (
    <div className="bank-lines relative flex flex-col justify-between gap-8 overflow-hidden bg-brand-900 p-8 text-paper-100">
      <div className="absolute inset-3 rounded-lg border border-brass-500/50" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-md bg-paper-50 font-serif text-sm font-bold text-brand-900 ring-1 ring-brass-500">
            <span aria-hidden="true" className="absolute inset-1 rounded-[4px] border border-brass-600/60" />
            <span className="relative">IF</span>
          </span>
          <span className="leading-none">
            <span className="block font-serif text-lg font-bold">InvoiceFlow</span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.22em] text-brass-200">Private Ledger</span>
          </span>
        </div>
        <h2 className="mt-10 font-serif text-[28px] font-bold leading-tight">{title}</h2>
        <div className="mt-3 h-[3px] w-14 rounded-full bg-brass-500" aria-hidden="true" />
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper-200/90">{body}</p>
      </div>
      <p className="relative text-[13px] leading-relaxed text-paper-200/80">
        Keys are re-issued by sealed letter. The reset link expires. Request a fresh one if it lapses.
      </p>
    </div>
  );
}

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const { error: err } = await resetPassword(email.trim());
      if (err) throw err;
      setInfo('If an account exists for that email, a reset link is on its way.');
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-100 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-ledger-lg md:grid-cols-2" style={{ borderColor: '#d8ccac' }}>
        <AuthBrandPanel
          title="Lost your key to the vault?"
          body="We will send a secure reset link to your address. No ledger entries are touched in the process."
        />
        <div className="p-7 sm:p-9">
          <p className="eyebrow">Recovery</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink-900">Reset password</h1>
          <p className="mt-1 text-sm text-ink-500">We&apos;ll email you a secure reset link.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
            </div>
            {error ? <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
            {info ? <p className="rounded-lg border border-brand-700/30 bg-brand-50 px-3 py-2 text-sm text-brand-800">{info}</p> : null}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-5 border-t pt-4 text-sm text-ink-500" style={{ borderColor: '#e5ddc6' }}>
            <Link to="/login" className="inline-flex items-center gap-1.5 font-bold text-brand-700 underline decoration-brass-600 decoration-2 underline-offset-4 hover:text-brand-800">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M13 8H3M8 4.5 4.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}



