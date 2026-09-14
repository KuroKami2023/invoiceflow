export default function StatCard({ label, value, sub }) {
  return (
    <div className="card group relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-brand-800" aria-hidden="true" />
      <div className="absolute inset-x-0 top-[3px] h-px bg-brass-600" aria-hidden="true" />
      <div className="eyebrow">{label}</div>
      <div className="tnum mt-1.5 font-serif text-[28px] font-bold leading-none text-ink-900">{value}</div>
      {sub ? <div className="mt-1.5 text-xs font-medium text-ink-500">{sub}</div> : null}
    </div>
  );
}
