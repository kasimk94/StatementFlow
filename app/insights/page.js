'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/DashboardLayout';

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

const CAT_STYLE = {
  'Subscription': { bg: 'rgba(99,102,241,0.12)',  color: '#818CF8', border: 'rgba(99,102,241,0.25)' },
  'Bill':         { bg: 'rgba(201,168,76,0.1)',   color: '#C9A84C', border: 'rgba(201,168,76,0.25)' },
  'Direct Debit': { bg: 'rgba(16,185,129,0.1)',   color: '#10B981', border: 'rgba(16,185,129,0.25)' },
};

function SkeletonRow() {
  return (
    <div style={{ height: 64, background: '#0D1117', borderRadius: 10, border: '1px solid rgba(201,168,76,0.06)', animation: 'sf-pulse 1.6s ease-in-out infinite' }} />
  );
}

export default function InsightsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [subscriptions, setSubscriptions] = useState([]);
  const [statementCount, setStatementCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.push('/login'); return; }
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => {
        setSubscriptions(d.subscriptions || []);
        setStatementCount(d.statementCount || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, router]);

  const totalMonthly = subscriptions.reduce((s, r) => s + r.averageAmount, 0);
  const totalAnnual  = totalMonthly * 12;

  return (
    <DashboardLayout title="Insights">
      <style>{`@keyframes sf-pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          Financial Insights
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          Patterns and subscriptions detected across your statement history
        </p>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
        </div>
      )}

      {/* Not enough statements */}
      {!loading && statementCount < 2 && (
        <div style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', marginBottom: 20,
          }}>
            🔄
          </div>
          <h2 style={{ color: '#F5F0E8', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Not enough data yet
          </h2>
          <p style={{ color: '#8A9BB5', fontSize: '0.9rem', maxWidth: 400, lineHeight: 1.65, margin: '0 0 28px' }}>
            Upload statements from at least 2 different months to start detecting your recurring subscriptions and bills automatically
          </p>
          {statementCount === 0 ? (
            <Link href="/statements" style={{
              padding: '11px 28px',
              background: 'linear-gradient(135deg,#C9A84C,#E8C97A)',
              color: '#080C14', fontWeight: 700, fontSize: '0.9rem',
              borderRadius: 50, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(201,168,76,0.35)',
            }}>
              Upload First Statement →
            </Link>
          ) : (
            <Link href="/statements" style={{
              padding: '11px 28px',
              background: 'linear-gradient(135deg,#C9A84C,#E8C97A)',
              color: '#080C14', fontWeight: 700, fontSize: '0.9rem',
              borderRadius: 50, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(201,168,76,0.35)',
            }}>
              Upload Another Month →
            </Link>
          )}
        </div>
      )}

      {/* Subscriptions section */}
      {!loading && statementCount >= 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ color: '#F5F0E8', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 3px' }}>
                Your Subscriptions &amp; Bills
              </h2>
              <p style={{ color: '#8A9BB5', fontSize: '0.82rem', margin: 0 }}>
                Detected across {statementCount} statement{statementCount !== 1 ? 's' : ''} · same merchant, consistent amount
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 700, color: '#8A9BB5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detected monthly cost</p>
              <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#C9A84C', lineHeight: 1 }}>{fmt(totalMonthly)}</p>
            </div>
          </div>

          {subscriptions.length === 0 ? (
            <div style={{ background: '#0D1117', border: '1px solid #1E2A3A', borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
                No consistent recurring payments found yet — accuracy improves with more statements
              </p>
            </div>
          ) : (
            <div style={{ background: '#0D1117', border: '1px solid #1E2A3A', borderRadius: 14, overflow: 'hidden' }}>
              {subscriptions.map((sub, i) => {
                const cs  = CAT_STYLE[sub.category] || CAT_STYLE.Subscription;
                const annual = sub.averageAmount * 12;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 20px',
                      borderBottom: i < subscriptions.length - 1 ? '1px solid #1E2A3A' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔄</span>

                    {/* Merchant info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#F5F0E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sub.merchantName}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#8A9BB5' }}>
                        {fmt(annual)}/year estimated
                      </p>
                    </div>

                    {/* Months seen badge */}
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      background: '#111820', color: '#8A9BB5',
                      padding: '3px 8px', borderRadius: 10, border: '1px solid #1E2A3A',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {sub.monthsDetected} month{sub.monthsDetected !== 1 ? 's' : ''}
                    </span>

                    {/* Category badge */}
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      background: cs.bg, color: cs.color,
                      padding: '3px 8px', borderRadius: 10, border: `1px solid ${cs.border}`,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {sub.category}
                    </span>

                    {/* Amount */}
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#C9A84C', minWidth: 72, textAlign: 'right', flexShrink: 0 }}>
                      {fmt(sub.averageAmount)}
                    </span>
                  </div>
                );
              })}

              {/* Total footer */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                background: 'rgba(201,168,76,0.04)',
                borderTop: '1px solid rgba(201,168,76,0.12)',
                flexWrap: 'wrap', gap: 8,
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#F5F0E8' }}>
                    Estimated recurring costs
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#8A9BB5' }}>
                    {fmt(totalAnnual)}/year
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#C9A84C', lineHeight: 1 }}>
                  {fmt(totalMonthly)}
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#8A9BB5' }}>/mo</span>
                </p>
              </div>
            </div>
          )}

          {/* Upload more CTA */}
          <div style={{
            background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)',
            borderRadius: 12, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#8A9BB5' }}>
              More statements = more accurate detection. Currently using {statementCount} statement{statementCount !== 1 ? 's' : ''}.
            </p>
            <Link href="/statements" style={{
              fontSize: '0.78rem', fontWeight: 700, color: '#C9A84C',
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Add Another Month →
            </Link>
          </div>

        </div>
      )}

    </DashboardLayout>
  );
}
