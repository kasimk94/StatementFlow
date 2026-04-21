'use client'

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as ReTooltip,
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

function fmtShort(n) {
  if (Math.abs(n) >= 1000) return '£' + (n / 1000).toFixed(1) + 'k';
  return fmt(n);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

function SkeletonKPICards() {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          style={{
            flex: '1 1 200px',
            height: 120,
            background: '#0D1117',
            border: '1px solid rgba(201,168,76,0.12)',
            borderRadius: 12,
            animation: 'sf-pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div
      style={{
        height: 300,
        background: '#0D1117',
        border: '1px solid rgba(201,168,76,0.12)',
        borderRadius: 16,
        animation: 'sf-pulse 1.5s ease-in-out infinite',
        marginBottom: 24,
      }}
    />
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
      <p style={{ color: '#F5F0E8', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 8px' }}>No statements yet</p>
      <p style={{ color: '#8A9BB5', fontSize: '0.875rem', margin: '0 0 24px' }}>Upload a bank statement to see your spending reports.</p>
      <Link href="/statements" style={{
        background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
        color: '#080C14',
        fontWeight: 700,
        fontSize: '0.875rem',
        padding: '10px 24px',
        borderRadius: 50,
        textDecoration: 'none',
        display: 'inline-block',
      }}>
        Upload Statement
      </Link>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, valueColor }) {
  return (
    <div style={{
      background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: 16,
      padding: '20px 24px',
    }}>
      <div style={{ color: '#8A9BB5', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ color: valueColor, fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>
        {value}
      </div>
      <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/statements')
      .then(r => r.json())
      .then(data => {
        setStatements(data.statements || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!statements.length) return null;
    const totalSpent = statements.reduce((s, st) => s + (st.totalOut || 0), 0);
    const avgMonthly = totalSpent / statements.length;
    const biggest = statements.reduce(
      (best, st) => (st.totalOut || 0) > (best.totalOut || 0) ? st : best,
      statements[0]
    );
    return { totalSpent, avgMonthly, biggest, count: statements.length };
  }, [statements]);

  const barData = useMemo(() => {
    return [...statements]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(st => ({
        name: fmtDate(st.dateFrom) || fmtDate(st.createdAt),
        spent: st.totalOut || 0,
        income: st.totalIn || 0,
      }));
  }, [statements]);

  return (
    <DashboardLayout title="Reports">
      <style>{`
        @keyframes sf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Reports
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          Spending analysis across all your statements
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <>
          <SkeletonKPICards />
          <SkeletonChart />
        </>
      )}

      {/* Empty state */}
      {!loading && !statements.length && <EmptyState />}

      {/* Content */}
      {!loading && statements.length > 0 && stats && (
        <>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            <KPICard
              label="Total Spent"
              value={fmt(stats.totalSpent)}
              sub={`${stats.count} statements`}
              valueColor="#EF4444"
            />
            <KPICard
              label="Avg Monthly Spend"
              value={fmt(stats.avgMonthly)}
              sub="per statement"
              valueColor="#C9A84C"
            />
            <KPICard
              label="Biggest Month"
              value={fmt(stats.biggest.totalOut)}
              sub={fmtDate(stats.biggest.dateFrom) || 'Unknown'}
              valueColor="#EF4444"
            />
            <KPICard
              label="Statements Saved"
              value={stats.count}
              sub="all time"
              valueColor="#C9A84C"
            />
          </div>

          {/* Spending Trend Chart */}
          <div style={{
            background: '#0D1117',
            border: '1px solid rgba(201,168,76,0.12)',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
          }}>
            <div style={{ color: '#F5F0E8', fontSize: '1rem', fontWeight: 700 }}>Spending Trend</div>
            <div style={{ color: '#8A9BB5', fontSize: '0.8rem', marginTop: 2, marginBottom: 20 }}>
              Money in vs out per statement
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }} barCategoryGap="20%" barGap={4}>
                <defs>
                  <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" />
                    <stop offset="100%" stopColor="rgba(239,68,68,0.3)" />
                  </linearGradient>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00D4A0" />
                    <stop offset="100%" stopColor="rgba(0,212,160,0.3)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#8A9BB5' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: '#8A9BB5' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReTooltip
                  contentStyle={{
                    background: '#0D1117',
                    border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: 8,
                    color: '#F5F0E8',
                  }}
                />
                <Bar dataKey="income" name="Money In" fill="url(#incomeGrad)" radius={[4, 4, 0, 0]} barSize={60} />
                <Bar dataKey="spent" name="Money Out" fill="url(#spentGrad)" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Statement History Table */}
          <div style={{
            background: '#0D1117',
            border: '1px solid rgba(201,168,76,0.12)',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px 24px 16px' }}>
              <div style={{ color: '#F5F0E8', fontSize: '1rem', fontWeight: 700 }}>Statement History</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(201,168,76,0.05)' }}>
                    {['Bank', 'Period', 'Money In', 'Money Out', 'Net', 'Transactions'].map(col => (
                      <th
                        key={col}
                        style={{
                          color: '#8A9BB5',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statements.map((st, idx) => (
                    <StatementRow key={st.id || idx} st={st} isLast={idx === statements.length - 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function StatementRow({ st, isLast }) {
  const [hovered, setHovered] = useState(false);
  const net = st.netBalance ?? ((st.totalIn || 0) - (st.totalOut || 0));

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(30,42,58,0.4)',
        background: hovered ? 'rgba(201,168,76,0.03)' : 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      <td style={{ padding: '14px 16px', color: '#F5F0E8', fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
        {st.bankName || '—'}
      </td>
      <td style={{ padding: '14px 16px', color: '#8A9BB5', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
        {fmtDate(st.dateFrom)} – {fmtDate(st.dateTo)}
      </td>
      <td style={{ padding: '14px 16px', color: '#00D4A0', fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
        {fmt(st.totalIn)}
      </td>
      <td style={{ padding: '14px 16px', color: '#EF4444', fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
        {fmt(st.totalOut)}
      </td>
      <td style={{ padding: '14px 16px', color: net >= 0 ? '#00D4A0' : '#EF4444', fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
        {fmt(net)}
      </td>
      <td style={{ padding: '14px 16px', color: '#C9A84C', fontWeight: 600, fontSize: '0.875rem' }}>
        {st.transactionCount ?? '—'}
      </td>
    </tr>
  );
}
