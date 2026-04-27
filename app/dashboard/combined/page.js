'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
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

function parsePeriodLabel(label) {
  const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const parts = String(label).split(' ');
  if (parts.length === 2 && MONTHS[parts[0]] !== undefined) {
    return new Date(+parts[1], MONTHS[parts[0]], 1);
  }
  return new Date(0);
}

// ─── Bank colours ─────────────────────────────────────────────────────────────

const NAMED_BANK_COLORS = {
  barclays: '#00AAFF',
  hsbc:     '#EE3124',
  monzo:    '#FF4B26',
  starling: '#7B35C1',
  halifax:  '#005EB8',
  natwest:  '#42145F',
};
const FALLBACK_BANK_COLORS = ['#C9A84C', '#818CF8', '#F59E0B', '#EC4899', '#00D4A0', '#3B82F6', '#EF4444', '#10B981'];

function bankColor(name, idx = 0) {
  const key = (name || '').toLowerCase().replace(/\s+/g, '');
  for (const [bank, color] of Object.entries(NAMED_BANK_COLORS)) {
    if (key.includes(bank)) return color;
  }
  return FALLBACK_BANK_COLORS[idx % FALLBACK_BANK_COLORS.length];
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS = {
  // Canonical names from the spec
  'Online Shopping':            '#C9A84C',
  'Direct Debits':              '#6366F1',
  'Cash & ATM':                 '#94A3B8',
  'Groceries':                  '#10B981',
  'Charity':                    '#EC4899',
  'High Street':                '#F59E0B',
  'Eating Out':                 '#EF4444',
  'Travel':                     '#3B82F6',
  'Other':                      '#64748B',
  // Mapped from actual parser category names
  'Supermarkets & Food':        '#10B981',
  'Eating & Drinking':          '#EF4444',
  'Travel & Transport':         '#3B82F6',
  'Online & High Street':       '#C9A84C',
  'Entertainment & Leisure':    '#818CF8',
  'Health & Fitness':           '#EC4899',
  'Household Bills':            '#6366F1',
  'Subscriptions & Streaming':  '#6366F1',
  'Finance & Bills':            '#475569',
  'Rent & Mortgage':            '#1e293b',
  'Bank Fees':                  '#94A3B8',
  'Charity & Donations':        '#EC4899',
  'Uncategorised':              '#64748B',
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

// ─── Donut tooltip ────────────────────────────────────────────────────────────

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

// ─── Bar chart tooltip ────────────────────────────────────────────────────────

function BarChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
      <div style={{ color: '#8A9BB5', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }}/>
          <span style={{ color: '#F5F0E8' }}>{p.name}: <strong>{fmt(p.value)}</strong></span>
        </div>
      ))}
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

function TxTable({ transactions, banks = [] }) {
  const [search,     setSearch]     = useState('');
  const [bankFilter, setBankFilter] = useState('All');
  const [page,       setPage]       = useState(0);
  const PAGE = 50;

  const filtered = useMemo(() => {
    let txns = transactions;
    if (bankFilter !== 'All') txns = txns.filter(t => t._bank === bankFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      txns = txns.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category    || '').toLowerCase().includes(q) ||
        (t._bank       || '').toLowerCase().includes(q)
      );
    }
    return txns;
  }, [transactions, search, bankFilter]);

  const pageCount = Math.ceil(filtered.length / PAGE);
  const visible   = filtered.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div>
      {/* Search + bank filter */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search transactions..."
          style={{
            flex: 1, minWidth: 160, background: '#080C14', border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 8, padding: '8px 12px', color: '#F5F0E8', fontSize: '0.875rem',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        {banks.length > 1 && (
          <select
            value={bankFilter}
            onChange={e => { setBankFilter(e.target.value); setPage(0); }}
            style={{
              background: '#080C14', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 8, padding: '8px 12px', color: '#F5F0E8', fontSize: '0.875rem',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="All">All banks</option>
            {banks.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
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
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', color: '#8A9BB5', fontSize: '0.85rem' }}>
                  No transactions match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
  const [txExpanded, setTxExpanded] = useState(false);

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

  // ── Merge all transactions ──
  const allTransactions = useMemo(() => {
    const txns = [];
    statements.forEach(st => {
      const bank = st.bankName || st.rawData?.bank || 'Unknown';
      (st.rawData?.transactions || []).forEach(t => txns.push({ ...t, _bank: bank, _statementId: st.id }));
    });
    txns.sort((a, b) => {
      const da = parseDateRaw(a.date), db = parseDateRaw(b.date);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return db - da;
    });
    return txns;
  }, [statements]);

  // ── Combined KPIs ──
  const kpis = useMemo(() => {
    let totalIn = 0, totalOut = 0, txnCount = 0;
    let earliest = null, latest = null;
    statements.forEach(st => {
      (st.rawData?.transactions || []).forEach(t => {
        if (t.exclude || t.isInternal) return;
        const amt = Number(t.amount) || 0;
        if (amt > 0) totalIn += amt; else totalOut += Math.abs(amt);
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
      map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [allTransactions]);

  const catTotal = useMemo(() => categoryBreakdown.reduce((s, c) => s + c.value, 0), [categoryBreakdown]);

  // ── Top merchants ──
  const topMerchants = useMemo(() => {
    const map = {};
    allTransactions.forEach(t => {
      if (t.exclude || t.isInternal || (Number(t.amount) || 0) >= 0) return;
      if (TRANSFER_CATS.has(t.category || '')) return;
      const key = (t.description || '').toLowerCase().trim();
      if (!key) return;
      if (!map[key]) map[key] = { name: t.description, total: 0, count: 0 };
      map[key].total += Math.abs(Number(t.amount) || 0);
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [allTransactions]);

  // ── Bank breakdown (named colours) ──
  const bankBreakdown = useMemo(() => {
    const map = {};
    statements.forEach((st, idx) => {
      const bank = st.bankName || st.rawData?.bank || 'Unknown';
      let totalIn = 0, totalOut = 0, txns = 0;
      (st.rawData?.transactions || []).forEach(t => {
        if (t.exclude || t.isInternal) return;
        const amt = Number(t.amount) || 0;
        if (amt > 0) totalIn += amt; else totalOut += Math.abs(amt);
        txns++;
      });
      const key = `${bank}-${idx}`;
      map[key] = { name: bank, totalIn, totalOut, txns, color: bankColor(bank, idx) };
    });
    return Object.values(map).sort((a, b) => b.totalOut - a.totalOut);
  }, [statements]);

  const maxOut = useMemo(() => Math.max(...bankBreakdown.map(b => b.totalOut), 0), [bankBreakdown]);

  // ── Spending trend data ──
  const { trendData, trendBanks } = useMemo(() => {
    const byPeriod = {};
    const bankSet  = new Set();

    statements.forEach((st, idx) => {
      const bank = st.bankName || st.rawData?.bank || 'Unknown';
      bankSet.add(bank);
      const d = parseDateRaw(st.dateFrom);
      const period = d
        ? d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        : (st.dateFrom || `Statement ${idx + 1}`);

      let totalOut = 0;
      (st.rawData?.transactions || []).forEach(t => {
        if (t.exclude || t.isInternal) return;
        const amt = Number(t.amount) || 0;
        if (amt < 0) totalOut += Math.abs(amt);
      });

      if (!byPeriod[period]) byPeriod[period] = { period };
      byPeriod[period][bank] = (byPeriod[period][bank] || 0) + totalOut;
    });

    const data = Object.values(byPeriod).sort((a, b) => parsePeriodLabel(a.period) - parsePeriodLabel(b.period));
    return { trendData: data, trendBanks: [...bankSet] };
  }, [statements]);

  // ── Most active month ──
  const monthActivity = useMemo(() => {
    const map = {};
    allTransactions.forEach(t => {
      const d = parseDateRaw(t.date);
      if (!d) return;
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      map[key] = (map[key] || 0) + 1;
    });
    let best = { period: null, count: 0 };
    Object.entries(map).forEach(([period, count]) => { if (count > best.count) best = { period, count }; });
    return best;
  }, [allTransactions]);

  // ── Auto-generated insights ──
  const insights = useMemo(() => {
    const list = [];
    if (bankBreakdown.length > 0) {
      const top = bankBreakdown[0];
      list.push(`Your biggest spending bank was ${top.name} at ${fmt(top.totalOut)}`);
    }
    if (categoryBreakdown.length > 0) {
      const topCat = categoryBreakdown[0];
      list.push(`You spent a total of ${fmt(topCat.value)} on ${topCat.name} across all accounts`);
    }
    if (monthActivity.period) {
      list.push(`Your most active month was ${monthActivity.period} with ${monthActivity.count} transactions`);
    }
    const net = kpis.totalIn - kpis.totalOut;
    list.push(`Net position across all accounts: ${net >= 0 ? '+' : ''}${fmt(net)}`);
    return list;
  }, [bankBreakdown, categoryBreakdown, monthActivity, kpis]);

  // ── Statement pills ──
  const statementPills = statements.map(st => {
    const bank = st.bankName || st.rawData?.bank || 'Statement';
    const label = st.dateFrom ? `${bank} · ${st.dateFrom}` : bank;
    return label;
  });

  if (loading) {
    return (
      <DashboardLayout title="Combined Dashboard">
        <style>{`@keyframes comb-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Sk h={56}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}><Sk/><Sk/><Sk/><Sk/></div>
          <Sk h={280}/>
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
                  color: '#C9A84C', fontSize: '0.78rem', fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                }}>
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <a
            href={`/api/download/combined?ids=${idsParam}`}
            download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
              background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14', textDecoration: 'none',
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
        <KPICard label="Total Money In"     value={fmt(kpis.totalIn)}  color="#10B981" sub={`${statements.length} statements`}/>
        <KPICard label="Total Money Out"    value={fmt(kpis.totalOut)} color="#EF4444" sub="excluding internals"/>
        <KPICard label="Total Transactions" value={kpis.txnCount}      color="#C9A84C" sub="across all banks"/>
        <KPICard label="Date Range"         value={kpis.dateRange}     color="#C9A84C"/>
      </div>

      {/* Spending Trend Chart */}
      {trendData.length > 0 && (
        <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, padding: 22, marginBottom: 24 }}>
          <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>Spending by Bank — Over Time</div>
          <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginBottom: 20 }}>Monthly spend per bank across all uploaded statements</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendData} barCategoryGap="28%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.07)" vertical={false}/>
              <XAxis
                dataKey="period"
                tick={{ fill: '#8A9BB5', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(201,168,76,0.12)' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => v >= 1000 ? `£${(v/1000).toFixed(0)}k` : `£${v}`}
                tick={{ fill: '#8A9BB5', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <ReTooltip content={<BarChartTooltip/>} cursor={{ fill: 'rgba(201,168,76,0.04)' }}/>
              {trendBanks.map((bank, i) => (
                <Bar key={bank} dataKey={bank} fill={bankColor(bank, i)} radius={[4, 4, 0, 0]} maxBarSize={52}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, justifyContent: 'center' }}>
            {trendBanks.map((bank, i) => (
              <div key={bank} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: bankColor(bank, i), flexShrink: 0 }}/>
                <span style={{ color: '#8A9BB5', fontSize: '0.75rem' }}>{bank}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending breakdown + Bank breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 24 }}>

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
            <BankBar key={i} {...b} maxOut={maxOut}/>
          ))}
        </div>
      </div>

      {/* Combined Insights */}
      <div style={{
        background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>
          ✨ Combined Insights
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ color: '#C9A84C', fontSize: '1rem', lineHeight: 1.4, flexShrink: 0 }}>•</span>
              <span style={{ color: '#8A9BB5', fontSize: '0.88rem', lineHeight: 1.6 }}>{ins}</span>
            </div>
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
              <div key={i} style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#8A9BB5', fontSize: '0.68rem', fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ color: '#8A9BB5', fontSize: '0.68rem' }}>{m.count}x</span>
                </div>
                <div style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {m.name}
                </div>
                <div style={{ color: '#EF4444', fontSize: '0.95rem', fontWeight: 800 }}>{fmt(m.total)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#8A9BB5', fontSize: '0.85rem' }}>No merchant data</p>
        )}
      </div>

      {/* Transaction table — collapsible */}
      <div style={{ background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: txExpanded ? '1px solid rgba(201,168,76,0.08)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700 }}>All Transactions</div>
            <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginTop: 2 }}>
              {allTransactions.length} transactions across {statements.length} statement{statements.length !== 1 ? 's' : ''}
            </div>
          </div>
          {!txExpanded && (
            <button
              onClick={() => setTxExpanded(true)}
              style={{
                background: 'transparent', border: '1px solid rgba(201,168,76,0.35)',
                color: '#C9A84C', padding: '8px 18px', borderRadius: 8,
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,168,76,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              View All {allTransactions.length} Transactions ↓
            </button>
          )}
        </div>

        {txExpanded && (
          <>
            <TxTable transactions={allTransactions} banks={trendBanks}/>
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(201,168,76,0.08)', textAlign: 'center' }}>
              <button
                onClick={() => setTxExpanded(false)}
                style={{
                  background: 'transparent', border: '1px solid rgba(201,168,76,0.2)',
                  color: '#8A9BB5', padding: '7px 20px', borderRadius: 8,
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#C9A84C'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#8A9BB5'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; }}
              >
                Hide Transactions ↑
              </button>
            </div>
          </>
        )}
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
