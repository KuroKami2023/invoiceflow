import { Link } from 'react-router-dom';

export default function EmptyState({ title, body, actionTo, actionLabel }) {
  return (
    <div className="card relative overflow-hidden py-12 text-center">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-brand-800" aria-hidden="true" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-brass-600/40 bg-paper-100 text-brand-800">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 3h13v18H5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M5 6.5h13" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 10.5h8M8 13.5h8M8 16.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="17" cy="17" r="4" fill="#faf8f1" stroke="#b45309" strokeWidth="1.5" />
          <path d="m15.5 17 1 1 2-2.2" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="mt-4 font-serif text-xl font-bold text-ink-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-500">{body}</p>
      {actionTo ? (
        <Link to={actionTo} className="btn-primary mt-5">
          {actionLabel}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}
