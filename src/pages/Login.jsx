import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { validateEmail, validatePassword } from '../utils/authValidate.js';

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
      <ul className="relative space-y-2.5 text-[13px] font-medium text-paper-200/90">
        <li className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-brass-300">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m5.5 8.2 1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Browser OCR. Files never leave your control unencrypted
        </li>
        <li className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-brass-300">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m5.5 8.2 1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Human-in-the-loop approval stamps
        </li>
        <li className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-brass-300">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="m5.5 8.2 1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Duplicate detection never auto-deletes
        </li>
      </ul>
    </div>
  );
}

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }
    const passCheck = validatePassword(password);
    if (!passCheck.ok) {
      setError(passCheck.error);
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) throw err;
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-100 px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border bg-white shadow-ledger-lg md:grid-cols-2" style={{ borderColor: '#d8ccac' }}>
        <AuthBrandPanel
          title="The private ledger for every invoice."
          body="Enter the counting house. Your pipeline: uploaded, reviewed, approved, kept in brass-bound order."
        />
        <div className="p-7 sm:p-9">
          <p className="eyebrow">Members entrance</p>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-ink-900">Log in</h1>
          <p className="mt-1 text-sm text-ink-500">Log in to process invoices with AI + OCR.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error ? <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
            <button className="btn-primary w-full" disabled={busy} type="submit">
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm" style={{ borderColor: '#e5ddc6' }}>
            <Link to="/register" className="font-bold text-brand-700 underline decoration-brass-600 decoration-2 underline-offset-4 hover:text-brand-800">Create account</Link>
            <Link to="/forgot-password" className="font-medium text-ink-500 hover:text-ink-800">Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
}





