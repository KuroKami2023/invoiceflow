import { STATUS_LABELS } from '../utils/constants.js';

const tones = {
  uploaded: 'border-ink-500/40 bg-paper-100 text-ink-600',
  processing: 'border-brand-700/50 bg-brand-50 text-brand-800',
  needs_review: 'border-brass-600/60 bg-brass-100 text-brass-700',
  approved: 'border-brand-700/60 bg-brand-50 text-brand-800',
  rejected: 'border-red-800/50 bg-red-50 text-red-800',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`stamp inline-flex items-center gap-1.5 rounded-[5px] border-2 border-double px-2 py-0.5 text-[11px] font-bold uppercase ${tones[status] || tones.uploaded}`}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
        <circle cx="4" cy="4" r="3" />
      </svg>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
