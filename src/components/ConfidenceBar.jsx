import { confidenceTone } from '../utils/format.js';

export default function ConfidenceBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 w-24 overflow-hidden rounded-full border bg-paper-200"
        style={{ borderColor: '#e5ddc6' }}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence ${v} percent`}
      >
        <div className={`h-full rounded-full transition-all duration-500 ${confidenceTone(v)}`} style={{ width: `${v}%` }} />
      </div>
      <span className="tnum text-xs font-bold text-ink-700">{v}%</span>
    </div>
  );
}
