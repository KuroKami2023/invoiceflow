import { FLAG_DESCRIPTIONS } from '../utils/constants.js';

export default function ValidationFlags({ flags }) {
  if (!flags || !flags.length) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m5.5 8.2 1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        No validation issues detected.
      </span>
    );
  }
  return (
    <ul className="space-y-1.5">
      {flags.map((flag) => (
        <li
          key={flag}
          className="flex items-start gap-2.5 rounded-lg border border-brass-600/40 bg-brass-50 px-3 py-2 text-xs text-ink-800"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-brass-600">
            <path
              d="M8 1.8 14.8 13.5H1.2L8 1.8Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M8 6v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
          </svg>
          <span>
            <span className="tnum font-mono font-bold tracking-tight">{flag}</span>
            <span className="text-ink-600"> — {FLAG_DESCRIPTIONS[flag] || 'Needs review.'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
