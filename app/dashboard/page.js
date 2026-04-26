'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import Dashboard from '@/components/Dashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <>
      <style>{`@keyframes sf-pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          height: 72, background: '#0D1117',
          border: '1px solid rgba(201,168,76,0.08)', borderRadius: 14,
          animation: 'sf-pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{ display: 'flex', gap: 14 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 110, background: '#0D1117',
              border: '1px solid rgba(201,168,76,0.08)', borderRadius: 14,
              animation: 'sf-pulse 1.6s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
        </div>
        {[0, 1].map(i => (
          <div key={i} style={{
            height: 260, background: '#0D1117',
            border: '1px solid rgba(201,168,76,0.08)', borderRadius: 14,
            animation: 'sf-pulse 1.6s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }} />
        ))}
      </div>
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      paddingTop: 80, textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    }}>
      {/* Gold document icon */}
      <svg width={56} height={56} viewBox="0 0 24 24" fill="none"
        stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>

      <h2 style={{
        color: '#F5F0E8', fontSize: '1.3rem', fontWeight: 700,
        margin: '20px 0 10px', letterSpacing: '-0.02em',
      }}>
        No statement loaded
      </h2>

      <p style={{
        color: '#8A9BB5', fontSize: '0.9rem', maxWidth: 360,
        lineHeight: 1.6, margin: '0 0 32px',
      }}>
        Upload a bank statement or select one from your history to view your dashboard
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/upload" style={{
          padding: '11px 24px',
          background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
          color: '#080C14', fontWeight: 700, fontSize: '0.875rem',
          borderRadius: 10, textDecoration: 'none',
        }}>
          Upload New Statement
        </Link>
        <Link href="/statements" style={{
          padding: '11px 24px',
          background: 'transparent',
          border: '1px solid rgba(201,168,76,0.35)',
          color: '#C9A84C', fontWeight: 600, fontSize: '0.875rem',
          borderRadius: 10, textDecoration: 'none',
        }}>
          View My Statements
        </Link>
      </div>
    </div>
  );
}

// ─── Statement header (bank name, date range, confidence, back + export) ──────

function StatementHeader({ statement, rawData }) {
  const bankName = statement?.bankName || rawData?.bank || 'Bank Statement';
  const dateFrom = fmtDate(statement?.dateFrom);
  const dateTo   = fmtDate(statement?.dateTo);
  const confidence = rawData?.confidence;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 12, marginBottom: 24,
      paddingBottom: 20, borderBottom: '1px solid rgba(201,168,76,0.12)',
    }}>
      {/* Left: back + info */}
      <div>
        <Link href="/statements" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: '#8A9BB5', fontSize: '0.8rem', fontWeight: 500,
          textDecoration: 'none', marginBottom: 8,
          transition: 'color 150ms',
        }}
          onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
          onMouseLeave={e => e.currentTarget.style.color = '#8A9BB5'}
        >
          ← My Statements
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{
            color: '#F5F0E8', fontSize: '1.4rem', fontWeight: 700,
            margin: 0, letterSpacing: '-0.02em',
          }}>
            {bankName}
          </h1>
          {dateFrom && dateTo && (
            <span style={{ color: '#8A9BB5', fontSize: '0.85rem' }}>
              {dateFrom} – {dateTo}
            </span>
          )}
          {confidence != null && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 600,
              color: confidence >= 80 ? '#10B981' : confidence >= 60 ? '#F59E0B' : '#EF4444',
              background: confidence >= 80 ? 'rgba(16,185,129,0.1)' : confidence >= 60 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
              padding: '3px 9px', borderRadius: 999,
              border: `1px solid ${confidence >= 80 ? 'rgba(16,185,129,0.25)' : confidence >= 60 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {confidence}% confidence
            </span>
          )}
        </div>
      </div>

      {/* Right: export buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={`/api/download?id=${statement?.id}`}
          download
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
            background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            color: '#080C14', textDecoration: 'none',
          }}
        >
          ↓ Download Excel
        </a>
        <Link href="/export" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '8px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
          background: 'transparent', border: '1px solid rgba(201,168,76,0.3)',
          color: '#C9A84C', textDecoration: 'none',
        }}>
          All Exports →
        </Link>
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message }) {
  return (
    <div style={{
      paddingTop: 80, textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    }}>
      <p style={{ color: '#EF4444', fontSize: '1rem', margin: 0 }}>{message}</p>
      <Link href="/statements" style={{
        padding: '11px 24px',
        background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
        color: '#080C14', fontWeight: 700, fontSize: '0.875rem',
        borderRadius: 10, textDecoration: 'none',
      }}>
        Go to My Statements
      </Link>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasUploadedThisMonth(statements) {
  const now = new Date();
  return (statements || []).some(s => {
    const d = new Date(s.createdAt);
    return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
}

const BANNER_KEY = 'sf_month_banner_v1';

function getBannerDismissKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}`;
}

// ─── Monthly upload reminder banner ───────────────────────────────────────────

function MonthBanner({ onDismiss }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10,
      background: 'rgba(201,168,76,0.07)',
      border: '1px solid rgba(201,168,76,0.25)',
      borderRadius: 12, padding: '12px 16px', marginBottom: 20,
    }}>
      <p style={{ margin: 0, color: '#C9A84C', fontSize: '0.875rem', fontWeight: 500 }}>
        📅 Haven't uploaded this month yet — add your latest statement to keep your insights up to date
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Link href="/upload" style={{
          background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14',
          fontWeight: 700, fontSize: '0.78rem', padding: '6px 14px',
          borderRadius: 999, textDecoration: 'none',
        }}>
          Upload Now
        </Link>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8A9BB5', padding: 4, display: 'flex', alignItems: 'center' }}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const [statement, setStatement] = useState(null);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  // Check if uploaded this month (only shown when a statement is loaded)
  useEffect(() => {
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(BANNER_KEY);
    if (dismissed === getBannerDismissKey()) return;
    fetch('/api/statements')
      .then(r => r.json())
      .then(d => { if (!hasUploadedThisMonth(d.statements)) setShowBanner(true); })
      .catch(() => {});
  }, []);

  function dismissBanner() {
    localStorage.setItem(BANNER_KEY, getBannerDismissKey());
    setShowBanner(false);
  }

  useEffect(() => {
    const statementId = searchParams.get('statementId');
    if (!statementId) {
      setLoading(false);
      return;
    }
    fetch(`/api/statements/${statementId}`)
      .then(r => r.json())
      .then(json => {
        if (json.statement?.rawData) {
          setStatement(json.statement);
          setData(json.statement.rawData);
        } else if (json.error) {
          setError(json.error === 'Unauthorized'
            ? 'Please log in to view this statement'
            : 'Statement not found');
        } else {
          setError('Statement not found');
        }
      })
      .catch(() => setError('Failed to load statement'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const statementId = searchParams.get('statementId');

  return (
    <DashboardLayout title="Dashboard">
      <style>{`
        @keyframes sf-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {showBanner && <MonthBanner onDismiss={dismissBanner} />}

      {loading && <Skeleton />}

      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && !statementId && <EmptyState />}

      {!loading && !error && statementId && !data && <ErrorState message="Statement not found" />}

      {!loading && !error && data && (
        <>
          <StatementHeader statement={statement} rawData={data} />
          <Dashboard
            transactions={data.transactions || []}
            bank={data.bank}
            confidence={data.confidence}
            overdraftLimit={data.overdraftLimit || 500}
            internalTransferTotal={data.internalTransferTotal || 0}
            reversalsCount={data.reversalsCount || 0}
            statementIncome={data.totalIncome}
            statementExpenses={data.totalExpenses}
            startBalance={data.startBalance}
            endBalance={data.endBalance}
            vatSummary={data.vatSummary}
            realIncome={data.realIncome}
            realSpending={data.realSpending}
            validation={data.validation}
          />
        </>
      )}
    </DashboardLayout>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}
