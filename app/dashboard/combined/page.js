'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  PieChart, Pie, Cell, Label, Tooltip as ReTooltip,
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
  if (parts.length === 2 && MONTHS[parts[0]] !== undefined) return new Date(+parts[1], MONTHS[parts[0]], 1);
  return new Date(0);
}

function dateDuration(earliest, latest) {
  if (!earliest || !latest) return '';
  let totalMonths = (latest.getFullYear() - earliest.getFullYear()) * 12 + latest.getMonth() - earliest.getMonth();
  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} yr${years !== 1 ? 's' : ''} ${months} mo`;
  if (years > 0) return `${years} year${years !== 1 ? 's' : ''}`;
  if (months > 0) return `${months} month${months !== 1 ? 's' : ''}`;
  return 'Same month';
}

function fmtDateShort(d) {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Bank colours ─────────────────────────────────────────────────────────────

const NAMED_BANK_COLORS = {
  hsbc:       '#EE3124',
  barclays:   '#00AEEF',
  monzo:      '#FF4F57',
  starling:   '#7FBA00',
  natwest:    '#551E75',
  nationwide: '#00539F',
  halifax:    '#005EB8',
  lloyds:     '#006A4E',
  santander:  '#EC0000',
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
  'Online Shopping':            '#C9A84C',
  'Direct Debits':              '#6366F1',
  'Cash & ATM':                 '#94A3B8',
  'Groceries':                  '#10B981',
  'Charity':                    '#EC4899',
  'High Street':                '#F59E0B',
  'Eating Out':                 '#EF4444',
  'Travel':                     '#3B82F6',
  'Other':                      '#64748B',
  'Supermarkets & Food':        '#10B981',
  'Eating & Drinking':          '#EF4444',
  'Travel & Transport':         '#3B82F6',
  'Online & High Street':       '#C9A84C',
  'Entertainment & Leisure':    '#818CF8',
  'Health & Fitness':           '#EC4899',
  'Household Bills':            '#6366F1',
  'Subscriptions & Streaming':  '#6366F1',
  'Finance & Bills':            '#475569',
  'Rent & Mortgage':            '#334155',
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
      border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16,
      animation: 'comb-pulse 1.5s ease-in-out infinite',
    }}/>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionTitle({ title, sub }) {
  return (
    <div style={{ borderLeft: '2px solid #C9A84C', paddingLeft: 10, marginBottom: sub ? 14 : 18 }}>
      <div style={{ color: '#F5F0E8', fontSize: '1.05rem', fontWeight: 700 }}>{title}</div>
      {sub && <div style={{ color: '#6B7280', fontSize: '0.8rem', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── KPI card icons ───────────────────────────────────────────────────────────

const KPIIcons = {
  in: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="16,12 12,8 8,12"/><line x1="12" y1="16" x2="12" y2="8"/>
    </svg>
  ),
  out: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="8,12 12,16 16,12"/><line x1="12" y1="8" x2="12" y2="16"/>
    </svg>
  ),
  txn: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  ),
  cal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accentColor, icon, dateRange, duration }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(135deg, #1A1A2E, #16213E)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 16,
        padding: '18px 20px',
        boxShadow: hovered
          ? `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}22`
          : '0 4px 24px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 200ms ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Icon top-right */}
      <div style={{ position: 'absolute', top: 14, right: 14, color: accentColor, opacity: 0.5 }}>
        {icon}
      </div>

      <div style={{ color: '#9CA3AF', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>
        {label}
      </div>

      {dateRange ? (
        <>
          <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3, paddingRight: 28 }}>
            {dateRange}
          </div>
          {duration && (
            <div style={{ color: '#6B7280', fontSize: '0.75rem', marginTop: 6 }}>{duration}</div>
          )}
        </>
      ) : (
        <>
          <div style={{ color: accentColor, fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {value}
          </div>
          {sub && <div style={{ color: '#6B7280', fontSize: '0.73rem', marginTop: 6 }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Donut tooltip ────────────────────────────────────────────────────────────

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: '#0F172A', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#F5F0E8' }}>
      <div style={{ color: '#F59E0B', fontWeight: 700, marginBottom: 2 }}>{name}</div>
      <div>{fmt(value)}</div>
    </div>
  );
}

// ─── Bar chart tooltip ────────────────────────────────────────────────────────

function BarChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
      <div style={{ color: '#9CA3AF', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }}/>
          <span style={{ color: '#E5E7EB' }}>{p.name}: <strong style={{ color: '#F5F0E8' }}>{fmt(p.value)}</strong></span>
        </div>
      ))}
    </div>
  );
}

// ─── Bank breakdown row ───────────────────────────────────────────────────────

function BankBar({ name, totalOut, totalIn, txns, maxOut, color }) {
  const pct = maxOut > 0 ? (totalOut / maxOut) * 100 : 0;
  return (
    <div style={{
      borderLeft: `4px solid ${color}`,
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '0 10px 10px 0',
      padding: '12px 16px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#F5F0E8', fontSize: '0.88rem', fontWeight: 600 }}>{name}</span>
        <span style={{
          background: 'rgba(255,255,255,0.06)', color: '#9CA3AF',
          fontSize: '0.68rem', fontWeight: 600,
          padding: '2px 8px', borderRadius: 999,
        }}>
          {txns} txns
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 999, marginBottom: 8 }}>
        <div style={{ height: '100%', borderRadius: 999, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#10B981', fontSize: '0.75rem', fontWeight: 700 }}>↑ {fmt(totalIn)}</span>
        <span style={{ color: '#EF4444', fontSize: '0.75rem', fontWeight: 700 }}>↓ {fmt(totalOut)}</span>
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
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search transactions..."
          style={{
            flex: 1, minWidth: 160, background: '#080C14', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '8px 12px', color: '#F5F0E8', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {banks.length > 1 && (
          <select
            value={bankFilter}
            onChange={e => { setBankFilter(e.target.value); setPage(0); }}
            style={{
              background: '#080C14', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: '8px 12px', color: '#F5F0E8', fontSize: '0.875rem', outline: 'none', cursor: 'pointer',
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
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Date', 'Bank', 'Description', 'Category', 'Amount'].map(col => (
                <th key={col} style={{
                  color: '#6B7280', fontSize: '0.68rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', padding: '10px 14px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap',
                }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => {
              const amt = Number(t.amount) || 0;
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 14px', color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{t.date || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.15)', color: '#C9A84C', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                      {t._bank || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#F5F0E8', fontSize: '0.82rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{t.category || '—'}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', color: amt >= 0 ? '#10B981' : '#EF4444' }}>{fmt(amt)}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '24px 14px', textAlign: 'center', color: '#6B7280', fontSize: '0.85rem' }}>No transactions match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: page === 0 ? '#374151' : '#C9A84C', padding: '6px 14px', borderRadius: 8, cursor: page === 0 ? 'default' : 'pointer', fontSize: '0.82rem' }}>
            ← Prev
          </button>
          <span style={{ color: '#6B7280', fontSize: '0.78rem' }}>Page {page + 1} of {pageCount} · {filtered.length} transactions</span>
          <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: page >= pageCount - 1 ? '#374151' : '#C9A84C', padding: '6px 14px', borderRadius: 8, cursor: page >= pageCount - 1 ? 'default' : 'pointer', fontSize: '0.82rem' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

const CARD_STYLE = {
  background: '#0D1117',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 16,
  padding: 22,
};

const INSIGHT_ICONS = ['🏦', '💳', '📅', '💰'];

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
    const dateRangeStr = earliest && latest
      ? `${fmtDateShort(earliest)} → ${fmtDateShort(latest)}`
      : '—';
    return { totalIn, totalOut, txnCount, dateRangeStr, earliest, latest };
  }, [statements]);

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

  const statementPills = statements.map(st => {
    const bank = st.bankName || st.rawData?.bank || 'Statement';
    return st.dateFrom ? `${bank} · ${st.dateFrom}` : bank;
  });

  if (loading) {
    return (
      <DashboardLayout title="Combined Dashboard">
        <style>{`@keyframes comb-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Sk h={56}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}><Sk/><Sk/><Sk/><Sk/></div>
          <Sk h={280}/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><Sk h={320}/><Sk h={320}/></div>
          <Sk h={140}/><Sk h={400}/>
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

  const duration = dateDuration(kpis.earliest, kpis.latest);

  return (
    <DashboardLayout title="Combined Dashboard">
      <style>{`@keyframes comb-pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/statements" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6B7280', fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none', marginBottom: 10 }}
          onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
          onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
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
                <span key={i} style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#C9A84C', fontSize: '0.78rem', fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <a href={`/api/download/combined?ids=${idsParam}`} download style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Excel
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16, marginBottom: 28 }}>
        <KPICard label="Total Money In"     accentColor="#10B981" icon={KPIIcons.in}  value={fmt(kpis.totalIn)}  sub={`${statements.length} statement${statements.length !== 1 ? 's' : ''}`}/>
        <KPICard label="Total Money Out"    accentColor="#EF4444" icon={KPIIcons.out} value={fmt(kpis.totalOut)} sub="excluding internals"/>
        <KPICard label="Total Transactions" accentColor="#F59E0B" icon={KPIIcons.txn} value={kpis.txnCount}      sub="across all banks"/>
        <KPICard label="Date Range"         accentColor="#8B5CF6" icon={KPIIcons.cal} dateRange={kpis.dateRangeStr} duration={duration}/>
      </div>

      {/* Spending Trend Chart */}
      {trendData.length > 0 && (
        <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
          <SectionTitle title="Spending by Bank — Over Time" sub="Monthly spend per bank across all uploaded statements"/>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={trendData} barCategoryGap="28%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false}/>
              <YAxis tickFormatter={v => v >= 1000 ? `£${(v/1000).toFixed(0)}k` : `£${v}`} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={52}/>
              <ReTooltip content={<BarChartTooltip/>} cursor={{ fill: 'rgba(255,255,255,0.02)' }}/>
              {trendBanks.map((bank, i) => (
                <Bar key={bank} dataKey={bank} fill={bankColor(bank, i)} radius={[4,4,0,0]} maxBarSize={52}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, justifyContent: 'center' }}>
            {trendBanks.map((bank, i) => (
              <div key={bank} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: bankColor(bank, i), flexShrink: 0 }}/>
                <span style={{ color: '#6B7280', fontSize: '0.75rem' }}>{bank}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Breakdown + Bank Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16, marginBottom: 24 }}>

        {/* Donut */}
        <div style={CARD_STYLE}>
          <SectionTitle title="Spending Breakdown" sub="Combined across all statements"/>
          {categoryBreakdown.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0 }}>
                <ResponsiveContainer width={220} height={220}>
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={62} outerRadius={100} paddingAngle={2}>
                      {categoryBreakdown.map((c, i) => <Cell key={i} fill={catColor(c.name)}/>)}
                      <Label
                        content={({ viewBox }) => {
                          const { cx, cy } = viewBox;
                          return (
                            <g>
                              <text x={cx} y={cy - 5} textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">{fmt(catTotal)}</text>
                              <text x={cx} y={cy + 12} textAnchor="middle" fill="#6B7280" fontSize="10">total</text>
                            </g>
                          );
                        }}
                      />
                    </Pie>
                    <ReTooltip content={<PieTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                {categoryBreakdown.slice(0, 7).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor(c.name), flexShrink: 0 }}/>
                    <span style={{ color: '#9CA3AF', fontSize: '0.7rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ color: '#C9A84C', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {catTotal > 0 ? `${((c.value / catTotal) * 100).toFixed(0)}%` : ''} · {fmt(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>No spending data</p>
          )}
        </div>

        {/* Bank breakdown */}
        <div style={CARD_STYLE}>
          <SectionTitle title="Bank Breakdown" sub="Spend contribution per bank"/>
          {bankBreakdown.map((b, i) => <BankBar key={i} {...b} maxOut={maxOut}/>)}
        </div>
      </div>

      {/* Combined Insights */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A, #1E293B)',
        border: '1px solid rgba(245,158,11,0.15)',
        borderRadius: 16, padding: 24, marginBottom: 24,
      }}>
        <div style={{ marginBottom: 18 }}>
          <span style={{ color: '#F59E0B', fontSize: '1.1rem', marginRight: 6 }}>✨</span>
          <span style={{ color: '#F5F0E8', fontSize: '1.05rem', fontWeight: 700 }}>Combined Insights</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.3 }}>{INSIGHT_ICONS[i] || '💡'}</span>
              <span style={{ color: '#E5E7EB', fontSize: '0.875rem', lineHeight: 1.6 }}>{ins}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Merchants */}
      <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
        <SectionTitle title="Top Merchants" sub="Highest spending merchants across all statements"/>
        {topMerchants.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10 }}>
            {topMerchants.map((m, i) => (
              <MerchantCard key={i} merchant={m} rank={i + 1}/>
            ))}
          </div>
        ) : (
          <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>No merchant data</p>
        )}
      </div>

      {/* Transaction table — collapsible */}
      <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '18px 22px 16px',
          borderBottom: txExpanded ? '1px solid rgba(255,255,255,0.04)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ color: '#F5F0E8', fontSize: '1rem', fontWeight: 700 }}>All Transactions</div>
            <div style={{ color: '#6B7280', fontSize: '0.78rem', marginTop: 2 }}>
              {allTransactions.length} transactions across {statements.length} statement{statements.length !== 1 ? 's' : ''}
            </div>
          </div>
          {!txExpanded && (
            <button
              onClick={() => setTxExpanded(true)}
              style={{ background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 150ms ease' }}
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
            <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <button
                onClick={() => setTxExpanded(false)}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6B7280', padding: '7px 20px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#C9A84C'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
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

// ─── Merchant card (hoisted out of render for clean hooks) ────────────────────

function MerchantCard({ merchant: m, rank }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#1C1C2E',
        border: `1px solid ${hovered ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12, padding: 16,
        transition: 'border-color 150ms ease',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#4B5563', fontSize: '0.72rem', fontWeight: 700 }}>#{rank}</span>
        <span style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>
          {m.count}×
        </span>
      </div>
      <div style={{ color: '#FFFFFF', fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
        {m.name}
      </div>
      <div style={{ color: '#F59E0B', fontSize: '1.15rem', fontWeight: 700 }}>
        {fmt(m.total)}
      </div>
    </div>
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
