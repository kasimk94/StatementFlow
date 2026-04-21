'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import Dashboard from '@/components/Dashboard';

// ─── Skeleton loader shown while fetching ────────────────────────────────────

function SkeletonCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: '#0D1117',
            border: '1px solid rgba(201,168,76,0.1)',
            borderRadius: 16,
            height: 120,
            animation: 'sf-pulse 1.6s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Empty state — no ?id param ──────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        paddingTop: 80,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <svg
        width={64}
        height={64}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C9A84C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>

      <p
        style={{
          color: '#F5F0E8',
          fontSize: '1.2rem',
          fontWeight: 600,
          marginTop: 16,
          marginBottom: 0,
        }}
      >
        No statement selected
      </p>

      <p
        style={{
          color: '#8A9BB5',
          fontSize: '0.95rem',
          marginTop: 6,
          marginBottom: 0,
        }}
      >
        Go to My Statements to view a saved statement&apos;s dashboard
      </p>

      <Link
        href="/statements"
        style={{
          display: 'inline-block',
          marginTop: 24,
          padding: '11px 24px',
          background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
          color: '#080C14',
          fontWeight: 700,
          fontSize: '0.9rem',
          borderRadius: 10,
          textDecoration: 'none',
          letterSpacing: '-0.01em',
        }}
      >
        My Statements
      </Link>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ message }) {
  return (
    <div
      style={{
        paddingTop: 80,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <p style={{ color: '#EF4444', fontSize: '1rem', margin: 0 }}>{message}</p>
      <Link
        href="/statements"
        style={{
          display: 'inline-block',
          padding: '11px 24px',
          background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
          color: '#080C14',
          fontWeight: 700,
          fontSize: '0.9rem',
          borderRadius: 10,
          textDecoration: 'none',
          letterSpacing: '-0.01em',
        }}
      >
        Go to My Statements
      </Link>
    </div>
  );
}

// ─── Inner component — uses useSearchParams, must be inside Suspense ─────────

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/statements/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.statement?.rawData) {
          setData(json.statement.rawData);
        } else {
          setError('Statement not found');
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <DashboardLayout title="Dashboard">
      {/* Inject sf-pulse keyframe once into the page */}
      <style>{`
        @keyframes sf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {loading && <SkeletonCards />}

      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && !data && <EmptyState />}

      {!loading && !error && data && (
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
      )}
    </DashboardLayout>
  );
}

// ─── Outer export — wraps inner in Suspense to satisfy useSearchParams ────────

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}
