import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatCard from '../components/StatCard.jsx';
import InvoiceTable from '../components/InvoiceTable.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatMoney } from '../utils/format.js';

const PIE_COLORS = ['#14532d', '#b45309', '#5f9871', '#991b1b', '#a8a29e'];

export default function Dashboard() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!mounted) return;
      if (err) setError(err.message);
      else setInvoices(data || []);
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = invoices.length;
    const approved = invoices.filter((i) => i.status === 'approved').length;
    const rejected = invoices.filter((i) => i.status === 'rejected').length;
    const needsReview = invoices.filter((i) => ['needs_review', 'uploaded', 'processing'].includes(i.status)).length;
    const processed = invoices.filter((i) => !['uploaded', 'processing'].includes(i.status)).length;
    const avgConf = total ? Math.round(invoices.reduce((a, i) => a + (Number(i.confidence) || 0), 0) / total) : 0;
    const totalValue = invoices.reduce((a, i) => a + (Number(i.total) || 0), 0);
    return { total, approved, rejected, needsReview, processed, avgConf, totalValue };
  }, [invoices]);

  const statusPie = useMemo(() => {
    const counts = {};
    for (const inv of invoices) counts[inv.status] = (counts[inv.status] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const valueByMonth = useMemo(() => {
    const buckets = {};
    for (const inv of invoices) {
      const key = (inv.invoice_date || inv.created_at || '').slice(0, 7) || 'unknown';
      buckets[key] = (buckets[key] || 0) + (Number(inv.total) || 0);
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-8)
      .map(([month, value]) => ({ month, value: Math.round(value * 100) / 100 }));
  }, [invoices]);

  if (loading) {
    return (
      <div className="space-y-4 py-4" aria-label="Loading dashboard">
        <div className="skeleton h-8 w-56" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
        <div className="skeleton h-56" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-5" style={{ borderColor: '#e5ddc6' }}>
        <div>
          <p className="eyebrow">General ledger · Private bank</p>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink-900">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">Welcome{user?.email ? `, ${user.email}` : ''} — here&apos;s your invoice pipeline.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/demo" className="btn-secondary">Explore demo</Link>
          <Link to="/upload" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8M5 5.5 8 2.5l3 3M2.5 10.5V13.5h11v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Upload invoices
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-800/30 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total invoices" value={stats.total} />
        <StatCard label="Processed" value={stats.processed} sub={`${stats.needsReview} need review`} />
        <StatCard label="Approved" value={stats.approved} sub={`${stats.rejected} rejected`} />
        <StatCard label="Avg confidence" value={`${stats.avgConf}%`} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card relative overflow-hidden p-5 md:col-span-2">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-brand-800" aria-hidden="true" />
          <p className="eyebrow">Book value</p>
          <h2 className="mt-1 font-serif text-lg font-bold text-ink-900">Total invoice value</h2>
          <p className="tnum mt-1 font-serif text-4xl font-bold tracking-tight text-brand-800">{formatMoney(stats.totalValue)}</p>
          <div className="rule-brass mt-3 w-16" aria-hidden="true" />
          <p className="mt-2 text-xs text-ink-500">Sum of extracted totals across all invoices.</p>
        </div>
        <div className="card relative overflow-hidden border-brass-600/40 bg-brass-50 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brass-700">Review queue</p>
          <h2 className="mt-1 font-serif text-lg font-bold text-ink-900">Needs review</h2>
          <p className="tnum mt-1 font-serif text-4xl font-bold text-brass-700">{stats.needsReview}</p>
          <Link to="/invoices?status=needs_review" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-700 underline decoration-brass-600 decoration-2 underline-offset-4 hover:text-brand-800">
            Open review queue
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          body="Upload your first invoice, or explore synthetic demo data to see the full review workflow."
          actionTo="/upload"
          actionLabel="Upload invoices"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="card p-5">
              <p className="eyebrow">Composition</p>
              <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">Invoices by status</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={80} label>
                      {statusPie.map((entry, i) => (
                        <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#faf8f1" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: '#e5ddc6', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <p className="eyebrow">Chronicle</p>
              <h2 className="mt-0.5 font-serif text-lg font-bold text-ink-900">Value by month</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valueByMonth}>
                    <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5ddc6' }} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} width={56} />
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: '#e5ddc6', fontSize: 12 }} />
                    <Bar dataKey="value" fill="#14532d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between border-b pb-3" style={{ borderColor: '#e5ddc6' }}>
              <div>
                <p className="eyebrow">Recent entries</p>
                <h2 className="font-serif text-lg font-bold text-ink-900">Recent invoices</h2>
              </div>
              <Link to="/invoices" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 underline decoration-brass-600 decoration-2 underline-offset-4 hover:text-brand-800">
                View all
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h9M8 4.5 11.5 8 8 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <InvoiceTable invoices={invoices.slice(0, 8)} />
          </div>
        </>
      )}
    </div>
  );
}
