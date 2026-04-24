'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) {
    // Try "DD Mon YYYY"
    const m = String(s).match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (m) return s;
    return s;
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseDateRaw(s) {
  if (!s) return null;
  const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const m1 = String(s).match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (m1) return new Date(+m1[3], MONTHS[m1[2]] ?? 0, +m1[1]);
  const m2 = String(s).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return new Date(+m2[3], +m2[2]-1, +m2[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Bank colour palette
const BANK_COLORS = [
  '#C9A84C', '#00D4A0', '#818CF8', '#F59E0B',
  '#EF4444', '#3B82F6', '#EC4899', '#10B981',
];

const CAT_COLORS = {
  'Supermarkets & Food':       '#22c55e',
  'Eating & Drinking':         '#f59e0b',
  'Travel & Transport':        '#0ea5e9',
  'Online & High Street':      '#3b82f6',
  'Entertainment & Leisure':   '#8b5cf6',
  'Health & Fitness':          '#ec4899',
  'Household Bills':           '#64748b',
  'Subscriptions & Streaming': '#a855f7',
  'Transfers Sent':            '#6366f1',
  'Transfers Received':        '#6366f1',
  'Income & Salary':           '#00b894',
  'Finance & Bills':           '#475569',
  'Rent & Mortgage':           '#1e293b',
  'Cash & ATM':                '#eab308',
  'Bank Fees':                 '#94a3b8',
  'Charity & Donations':       '#a855f7',
  'Uncategorised':             '#f87171',
};
function catColor(name) { return CAT_COLORS[name] || '#74b9ff'; }

const TRANSFER_CATS = new Set(['Transfers Sent', 'Transfers Received', 'Internal Transfer']);

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ h = 120 }) {
  return (
    <div style={{
      height: h, background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.08)', borderRadius: 14,
      animation: 'comb-pulse 1.5s ease-in-out infinite',
    }}/>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color = '#C9A84C' }) {
  return (
    <div style={{
      background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: 14, padding: '18px 22px',
    }}>
      <div style={{ color: '#8A9BB5', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ color, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ color: '#8A9BB5', fontSize: '0.75rem', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Custom donut tooltip ─────────────────────────────────────────────────────

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#F5F0E8' }}>
      <div style={{ color: '#C9A84C', fontWeight: 700, marginBottom: 2 }}>{name}</div>
      <div>{fmt(value)}</div>
    </div>
  );
}

// ─── Bank breakdown bar ───────────────────────────────────────────────────────

function BankBar({ name, totalOut, totalIn, txns, maxOut, color }) {
  const pct = maxOut > 0 ? (totalOut / maxOut) * 100 : 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}/>
          <span style={{ color: '#F5F0E8', fontSize: '0.9rem', fontWeight: 600 }}>{name}</span>
        </div>
        <span style={{ color: '#8A9BB5', fontSize: '0.78rem' }}>{txns} txns</span>
      </div>
      <div style={{ height: 6, background: '#1E2A3A', borderRadius: 999, marginBottom: 4 }}>
        <div style={{ height: '100%', borderRadius: 999, background: color, width: `${pct}%`, transition: 'width 0.5s ease' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#10B981', fontSize: '0.75rem' }}>In: {fmt(totalIn)}</span>
        <span style={{ color: '#EF4444', fontSize: '0.75rem' }}>Out: {fmt(totalOut)}</span>
      </div>
    </div>
  );
}

// ─── Transaction table ────────────────────────────────────────────────────────

function TxTable({ transactions }) {
  const [search, setSearch] = useState('');
  const [page,   setPage]   = useState(0);
  const PAGE = 50;

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(t =>
      (t.description || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t._bank || '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const pageCount = Math.ceil(filtered.length / PAGE);
  const visible   = filtered.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div>
      {/* Search */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search transactions..."
          style={{
            width: '100%', background: '#080C14', border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 8, padding: '8px 12px', color: '#F5F0E8', fontSize: '0.875rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr style={{ background: 'rgba(201,168,76,0.05)' }}>
              {['Date', 'Bank', 'Description', 'Category', 'Amount'].map(col => (
                <th key={col} style={{
                  color: '#8A9BB5', fontSize: '0.68rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', padding: '10px 14px', textAlign: 'left',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => {
              const amt = Number(t.amount) || 0;
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(30,42,58,0.3)' }}>
                  <td style={{ padding: '10px 14px', color: '#8A9BB5', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {t.date || '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)',
                      color: '#C9A84C', fontSize: '0.7rem', fontWeight: 600,
                      padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                    }}>
                      {t._bank || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#F5F0E8', fontSize: '0.82rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#8A9BB5', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {t.category || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', color: amt >= 0 ? '#10B981' : '#EF4444' }}>
                    {fmt(amt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid rgba(30,42,58,0.4)' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: page === 0 ? '#1E2A3A' : '#C9A84C', padding: '6px 14px', borderRadius: 8, cursor: page === 0 ? 'default' : 'pointer', fontSize: '0.82rem' }}
          >
            ← Prev
          </button>
          <span style={{ color: '#8A9BB5', fontSize: '0.78rem' }}>
            Page {page + 1} of {pageCount} · {filtered.length} transactions
          </span>
          <button
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            style={{ background: 'transparent', border: '1px solid rgba(201,168,76,0.2)', color: page >= pageCount - 1 ? '#1E2A3A' : '#C9A84C', padding: '6px 14px', borderRadius: 8, cursor: page >= pageCount - 1 ? 'default' : 'pointer', fontSize: '0.82rem' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function CombinedInner() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const ids = idsParam.split(',').filter(Boolean);

  const [statements, setStatements] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!ids.length) { setLoading(false); return; }
    Promise.all(
      ids.map(id =>
        fetch(`/api/statements/${id}`)
          .then(r => r.json())
          .then(d => d.statement || null)
          .catch(() => null)
      )
    ).then(results => {
      setStatements(results.filter(Boolean));
      setLoading(false);
    }).catch(() => { setError('Failed to load statements'); setLoading(false); });
  }, [idsParam]); // eslint-disable-line

  // ── Merge all transactions, tagging with bank ──
  const allTransactions = useMemo(() => {
    const txns = [];
    statements.forEach(st => {
      const rawTxns = st.rawData?.transactions || [];
      const bank    = st.bankName || st.rawData?.bank || 'Unknown';
      rawTxns.forEach(t => txns.push({ ...t, _bank: bank, _statementId: st.id }));
    });
    // Sort by date descending
    txns.sort((a, b) => {
      const da = parseDateRaw(a.date), db = parseDateRaw(b.date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db - da;
    });
    return txns;
  }, [statements]);

  // ── Combined KPIs ──
  const kpis = useMemo(() => {
    let totalIn = 0, totalOut = 0, txnCount = 0;
    let earliest = null, latest = null;

    statements.forEach(st => {
      const rawTxns = st.rawData?.transactions || [];
      rawTxns.forEach(t => {
        if (t.exclude || t.isInternal) return;
        const amt = Number(t.amount) || 0;
        if (amt > 0) totalIn  += amt;
        else         totalOut += Math.abs(amt);
        txnCount++;
        const d = parseDateRaw(t.date);
        if (d) {
          if (!earliest || d < earliest) earliest = d;
          if (!latest   || d > latest)   latest   = d;
        }
      });
    });

    const dateRange = earliest && latest
      ? `${earliest.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${latest.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '—';

    return { totalIn, totalOut, txnCount, dateRange };
  }, [statements]);

  // ── Category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const map = {};
    allTransactions.forEach(t => {
      if (t.exclude || t.isInternal || (Number(t.amount) || 0) >= 0) return;
      const cat = t.category || 'Uncategorised';
      if (TRANSFER_CATS.has(cat)) return;
      if (!map[cat]) map[cat] = 0;
      map[cat] += Math.abs(Number(t.amount) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allTransactions]);

  const catTotal = useMemo(() => categoryBreakdown.reduce((s, c) => s + c.value, 0), [categoryBreakdown]);

  // ── Top merchants ──
  const topMerchants = useMemo(() => {
    const map = {};
    allTransactions.forEach(t => {
      if (t.exclude || t.isInternal || (Number(t.amount) || 0) >= 0) return;
      const cat = t.category || '';
      if (TRANSFER_CATS.has(cat)) return;
      const key = (t.description || '').toLowerCase().trim();
      if (!key) return;
      if (!map[key]) map[key] = { name: t.description, total: 0, count: 0 };
      map[key].total += Math.abs(Number(t.amount) || 0);
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [allTransactions]);

  // ── Bank breakdown ──
  const bankBreakdown = useMemo(() => {
    const map = {};
    statements.forEach((st, idx) => {
      const bank = st.bankName || st.rawData?.bank || 'Unknown';
      const rawTxns = st.rawData?.transactions || [];
      let totalIn = 0, totalOut = 0, txns = 0;
      rawTxns.forEach(t => {
        if (t.exclude || t.isInternal) return;
        const amt = Number(t.amount) || 0;
        if (amt > 0) totalIn  += amt;
        else         totalOut += Math.abs(amt);
        txns++;
      });
      const key = `${bank}-${idx}`;
      map[key] = { name: bank, totalIn, totalOut, txns, color: BANK_COLORS[idx % BANK_COLORS.length] };
    });
    return Object.values(map).sort((a, b) => b.totalOut - a.totalOut);
  }, [statements]);

  const maxOut = useMemo(() => Math.max(...bankBreakdown.map(b => b.totalOut), 0), [bankBreakdown]);

  // ── Statement pills ──
  const statementPills = statements.map(st => {
    const bank = st.bankName || st.rawData?.bank || 'Statement';
    const from = st.dateFrom;
    const label = from ? `${bank} · ${from}` : bank;
    return label;
  });

  if (loading) {
    return (
      <DashboardLayout title="Combined Dashboard">
        <style>{`@keyframes comb-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Sk h={56}/> <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}><Sk/><Sk/><Sk/><Sk/></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><Sk h={300}/><Sk h={300}/></div>
          <Sk h={400}/>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !statements.length) {
    return (
      <DashboardLayout title="Combined Dashboard">
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <p style={{ color: '#EF4444', marginBottom: 20 }}>{error || 'No statements found.'}</p>
          <Link href="/statements" style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>← My Statements</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Combined Dashboard">
      <style>{`@keyframes comb-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/statements" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: '#8A9BB5', fontSize: '0.8rem', fontWeight: 500,
          textDecoration: 'none', marginBottom: 10,
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
          onMouseLeave={e => e.currentTarget.style.color = '#8A9BB5'}
        >
          ← My Statements
        </Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#F5F0E8', fontSize: '1.5rem', fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              Combined Statement Analysis
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {statementPills.map((pill, i) => (
                <span key={i} style={{
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
                  color: '#C9A84C', fontSize: '0.78rem', fontWeight: 600,
                  padding: '4px 12px', borderRadius: 999,
                }}>
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* Export */}
          <a
            href={`/api/download/combined?ids=${idsParam}`}
            download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
              background: 'linear-gradient(135deg,#C9A84C,#E8C97A)',
              color: '#080C14', textDecoration: 'none',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Excel
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        <KPICard label="Total Money In"    value={fmt(kpis.totalIn)}   color="#10B981" sub={`${statements.length} statements`}/>
        <KPICard label="Total Money Out"   value={fmt(kpis.totalOut)}  color="#EF4444" sub="excluding internals"/>
        <KPICard label="Total Transactions" value={kpis.txnCount}       color="#C9A84C" sub="across all banks"/>
        <KPICard label="Date Range"        value={kpis.dateRange}       color="#C9A84C" style={{ fontSize: '0.95rem' }}/>
      </div>

      {/* Spending breakdown + Bank breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Donut */}
        <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, padding: 22 }}>
          <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>Spending Breakdown</div>
          <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginBottom: 16 }}>Combined across all statements</div>

          {categoryBreakdown.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                      {categoryBreakdown.map((c, i) => <Cell key={i} fill={catColor(c.name)}/>)}
                    </Pie>
                    <ReTooltip content={<PieTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                {categoryBreakdown.slice(0, 7).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor(c.name), flexShrink: 0 }}/>
                    <span style={{ color: '#8A9BB5', fontSize: '0.72rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ color: '#C9A84C', fontSize: '0.72rem', fontWeight: 700 }}>
                      {catTotal > 0 ? `${((c.value / catTotal) * 100).toFixed(0)}%` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: '#8A9BB5', fontSize: '0.85rem' }}>No spending data</p>
          )}
        </div>

        {/* Bank breakdown */}
        <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, padding: 22 }}>
          <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>Bank Breakdown</div>
          <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginBottom: 20 }}>Spend contribution per bank</div>
          {bankBreakdown.map((b, i) => (
            <BankBar key={i} {...b} maxOut={maxOut} />
          ))}
        </div>
      </div>

      {/* Top Merchants */}
      <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, padding: 22, marginBottom: 24 }}>
        <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>Top Merchants</div>
        <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginBottom: 20 }}>Highest spending merchants across all statements</div>
        {topMerchants.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
            {topMerchants.map((m, i) => (
              <div key={i} style={{
                background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#8A9BB5', fontSize: '0.68rem', fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ color: '#8A9BB5', fontSize: '0.68rem' }}>{m.count}x</span>
                </div>
                <div style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {m.name}
                </div>
                <div style={{ color: '#EF4444', fontSize: '0.95rem', fontWeight: 800 }}>
                  {fmt(m.total)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#8A9BB5', fontSize: '0.85rem' }}>No merchant data</p>
        )}
      </div>

      {/* Transaction table */}
      <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
          <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700 }}>All Transactions</div>
          <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginTop: 2 }}>
            {allTransactions.length} transactions across {statements.length} statements
          </div>
        </div>
        <TxTable transactions={allTransactions} />
      </div>
    </DashboardLayout>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CombinedDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CombinedInner />
    </Suspense>
  );
}
