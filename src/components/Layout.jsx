import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const linkClass = ({ isActive }) =>
  `relative rounded-md px-3 py-2 text-sm font-semibold transition-all duration-150 ${
    isActive
      ? 'bg-brand-600 text-white shadow-ledger'
      : 'text-ink-600 hover:bg-paper-200 hover:text-brand-800'
  }`;

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

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen">
      <div className="h-1 w-full bg-brand-800" aria-hidden="true">
        <div className="mx-auto h-full max-w-6xl px-4">
          <div className="h-full w-24 bg-brass-600" aria-hidden="true" />
        </div>
      </div>
      <header className="sticky top-0 z-10 border-b bg-paper-50/95 backdrop-blur" style={{ borderColor: '#e5ddc6' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/dashboard" className="shrink-0" aria-label="InvoiceFlow home">
            <Wordmark />
          </NavLink>
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto" aria-label="Primary">
            <NavLink to="/dashboard" end className={linkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/upload" className={linkClass}>
              Upload
            </NavLink>
            <NavLink to="/invoices" className={linkClass}>
              Invoices
            </NavLink>
            <NavLink to="/demo" className={linkClass}>
              Demo
            </NavLink>
          </nav>
          <div className="order-2 flex items-center gap-3 sm:order-3">
            <span className="hidden max-w-[220px] truncate text-xs text-ink-500 lg:block" title={user?.email}>
              {user?.email}
            </span>
            <button onClick={handleSignOut} className="btn-secondary !px-3 !py-1.5 !text-[13px]">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3H3v10h3M10 5l3 3-3 3M13 8H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="page-enter mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8">
        <div className="flex flex-col items-center gap-2 border-t pt-5 text-center" style={{ borderColor: '#e5ddc6' }}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-500">
            <span className="inline-block h-px w-8 bg-brass-600" aria-hidden="true" />
            InvoiceFlow, Private Ledger
            <span className="inline-block h-px w-8 bg-brass-600" aria-hidden="true" />
          </div>
          <p className="text-xs text-ink-500">AI + OCR invoice extraction with human-in-the-loop review</p>
        </div>
      </footer>
    </div>
  );
}


