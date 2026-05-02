'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Bell, Upload } from 'lucide-react';
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Main card */}
      <div style={{
        maxWidth: 480, width: '100%',
        padding: '48px 32px',
        background: '#16161E',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20,
        margin: '40px auto 0',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <Upload size={40} color="#F59E0B" strokeWidth={1.5} />

        <h2 style={{
          fontSize: 22, fontWeight: 700, color: '#F5F0E8',
          marginTop: 16, marginBottom: 0, letterSpacing: '-0.02em',
        }}>
          Ready when you are
        </h2>

        <p style={{
          fontSize: 14, color: '#6B7280', lineHeight: 1.6,
          marginTop: 8, marginBottom: 0, maxWidth: 360,
        }}>
          Upload your bank statement PDF and get instant clarity on your spending — no bank login, no waiting.
        </p>

        <Link href="/statements" style={{
          display: 'block', width: '100%',
          padding: '14px', marginTop: 24,
          background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
          color: '#080C14', fontWeight: 600, fontSize: 15,
          borderRadius: 12, textDecoration: 'none', textAlign: 'center',
          boxShadow: '0 4px 16px rgba(201,168,76,0.25)',
          boxSizing: 'border-box',
        }}>
          Upload Your First Statement →
        </Link>

        {/* Trust micro-statements */}
        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          marginTop: 16, fontSize: 12, color: '#4B5563',
        }}>
          <span>🔒 No bank login</span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
          <span>⚡ Ready in 60s</span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
          <span>🗑️ Files never stored</span>
        </div>

        {/* Demo link */}
        <Link href="/" style={{
          display: 'inline-block', marginTop: 20,
          fontSize: 13, color: '#F59E0B', textDecoration: 'none', opacity: 0.75,
          transition: 'opacity 0.15s ease',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
        >
          Or view a demo →
        </Link>
      </div>

      {/* Supported banks row */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        justifyContent: 'center', alignItems: 'center',
        marginTop: 24, fontSize: 12, color: '#6B7280',
      }}>
        <span style={{ marginRight: 2 }}>Works with:</span>
        {['Barclays', 'HSBC', 'Monzo', 'Starling', 'Lloyds', 'NatWest', 'Santander'].map(bank => (
          <span key={bank} style={{
            padding: '3px 10px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: '#6B7280', fontSize: 11,
          }}>
            {bank}
          </span>
        ))}
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
  const [btnHover, setBtnHover] = useState(false);
  const [xHover, setXHover] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10,
      background: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 12, padding: '12px 16px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bell size={16} color="#F59E0B" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, color: '#D1D5DB', fontSize: '14px', fontWeight: 400 }}>
          Haven't uploaded this month yet — add your latest statement to keep your insights up to date
        </p>
      </div>
      <div className="sf-banner-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Link
          href="/upload"
          style={{
            background: btnHover ? 'rgba(245,158,11,0.1)' : 'transparent',
            color: '#F59E0B',
            border: '1px solid #F59E0B',
            fontWeight: 600, fontSize: '13px', padding: '6px 16px',
            borderRadius: 8, textDecoration: 'none',
            transition: 'background 150ms',
          }}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
        >
          Upload Now
        </Link>
        <button
          onClick={onDismiss}
          onMouseEnter={() => setXHover(true)}
          onMouseLeave={() => setXHover(false)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: xHover ? '#9CA3AF' : '#6B7280', padding: 4, display: 'flex', alignItems: 'center', transition: 'color 150ms' }}
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
    <DashboardLayout title="">
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
