'use client';

const FEATURE_COPY = {
  history: {
    title: 'Statement history is a Pro feature',
    desc:  'Upgrade to Pro to browse, revisit, and manage all your saved statements.',
  },
  budget: {
    title: 'Budget planner is a Pro feature',
    desc:  'Upgrade to Pro to track your monthly budget and spending targets.',
  },
  excel: {
    title: 'Excel export is a Pro feature',
    desc:  'Upgrade to Pro to download your statements as formatted Excel workbooks.',
  },
  audit: {
    title: 'Audit-Ready view is a Pro feature',
    desc:  'Upgrade to Pro to access the accountant P&L summary and VAT report.',
  },
  bulk: {
    title: 'Bulk upload is a Business feature',
    desc:  'Upgrade to Business to upload up to 6 statements at once for a combined multi-bank analysis.',
    businessOnly: true,
  },
  uploads: {
    title: 'Monthly upload limit reached',
    desc:  "You've used all 3 free uploads this month. Upgrade to Pro for unlimited uploads.",
  },
};

export default function UpgradeModal({ feature, onClose }) {
  const copy = FEATURE_COPY[feature] || FEATURE_COPY.uploads;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: '#0D1117', border: '1px solid rgba(201,168,76,0.25)',
        borderRadius: 20, padding: 32, maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        </div>

        <h2 style={{ color: '#F5F0E8', fontSize: '1.15rem', fontWeight: 700, textAlign: 'center', marginBottom: 10, letterSpacing: '-0.02em' }}>
          {copy.title}
        </h2>
        <p style={{ color: '#8A9BB5', fontSize: '0.875rem', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          {copy.desc}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!copy.businessOnly && (
            <form action="/api/stripe/checkout" method="POST">
              <input type="hidden" name="plan" value="PRO" />
              <button type="submit" style={{
                width: '100%',
                background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
                color: '#080C14', fontWeight: 700, fontSize: '0.95rem',
                padding: '13px 24px', borderRadius: 50, border: 'none',
                cursor: 'pointer', boxShadow: '0 4px 20px rgba(201,168,76,0.35)',
              }}>
                Upgrade to Pro — £4.99/mo
              </button>
            </form>
          )}
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="plan" value="BUSINESS" />
            <button type="submit" style={{
              width: '100%',
              background: copy.businessOnly ? 'linear-gradient(135deg,#818CF8,#6366f1)' : 'rgba(129,140,248,0.1)',
              color: copy.businessOnly ? '#fff' : '#818CF8',
              border: copy.businessOnly ? 'none' : '1px solid rgba(129,140,248,0.3)',
              fontWeight: copy.businessOnly ? 700 : 600,
              fontSize: '0.9rem', padding: '12px 24px', borderRadius: 50, cursor: 'pointer',
              boxShadow: copy.businessOnly ? '0 4px 16px rgba(129,140,248,0.3)' : 'none',
            }}>
              {copy.businessOnly ? 'Upgrade to Business — £19.99/mo' : 'Business — £19.99/mo'}
            </button>
          </form>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#8A9BB5',
              fontSize: '0.85rem', cursor: 'pointer', padding: '8px', textAlign: 'center',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
