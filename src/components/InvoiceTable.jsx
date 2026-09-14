import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import ConfidenceBar from './ConfidenceBar.jsx';
import { formatMoney, formatDate } from '../utils/format.js';

export default function InvoiceTable({ invoices }) {
  if (!invoices.length) {
    return <p className="py-8 text-center text-sm text-ink-500">No invoices match your filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="ledger-table w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2.5 pr-3">Supplier</th>
            <th className="px-3 py-2.5 pr-3">Number</th>
            <th className="px-3 py-2.5 pr-3">Date</th>
            <th className="px-3 py-2.5 pr-3 text-right">Total</th>
            <th className="px-3 py-2.5 pr-3">Confidence</th>
            <th className="px-3 py-2.5 pr-3">Status</th>
            <th className="px-3 py-2.5">Open</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} className="ledger-row">
              <td className="px-3 py-2.5 pr-3 font-serif font-semibold text-ink-900">{inv.supplier || '—'}</td>
              <td className="tnum px-3 py-2.5 pr-3 font-mono text-xs text-ink-700">{inv.invoice_number || '—'}</td>
              <td className="tnum px-3 py-2.5 pr-3 text-ink-700">{formatDate(inv.invoice_date)}</td>
              <td className="tnum px-3 py-2.5 pr-3 text-right font-semibold text-ink-900">{formatMoney(inv.total, inv.currency)}</td>
              <td className="px-3 py-2.5 pr-3">
                <ConfidenceBar value={inv.confidence} />
              </td>
              <td className="px-3 py-2.5 pr-3">
                <StatusBadge status={inv.status} />
              </td>
              <td className="px-3 py-2.5">
                <Link
                  to={`/invoices/${inv.id}`}
                  className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-700 underline decoration-brass-600 decoration-2 underline-offset-4 hover:text-brand-800 hover:decoration-brand-800"
                >
                  Review
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
