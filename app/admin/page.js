'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const ADMIN_EMAIL = 'kasimkhalid63@gmail.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateShort(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }) {
  const styles = {
    FREE:     { background: '#1E2A3A',                                 color: '#8A9BB5' },
    PRO:      { background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14' },
    BUSINESS: { background: 'linear-gradient(135deg,#818CF8,#6366f1)', color: '#fff'    },
  };
  const s = styles[plan] || styles.FREE;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 999,
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', ...s,
    }}>
      {plan}
    </span>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KPI({ label, value, sub }) {
  return (
    <div style={{
      background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{ color: '#8A9BB5', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ color: '#C9A84C', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ color: '#8A9BB5', fontSize: '0.78rem', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div style={{
      background: '#0D1117', border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: 16, overflow: 'hidden', marginBottom: 24,
    }}>
      {title && (
        <div style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid rgba(201,168,76,0.08)',
          color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 700,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, noun }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D1117', border: '1px solid rgba(201,168,76,0.2)',
      borderRadius: 8, padding: '10px 14px',
      color: '#F5F0E8', fontSize: '0.82rem',
    }}>
      <div style={{ color: '#C9A84C', fontWeight: 700, marginBottom: 2 }}>
        {fmtDateShort(label)}
      </div>
      <div>{payload[0].value} {noun}</div>
    </div>
  );
}

// ─── Admin Sidebar ────────────────────────────────────────────────────────────

const NAV = [
  { label: 'Dashboard',  icon: 'grid' },
  { label: 'Users',      icon: 'users' },
  { label: 'Statements', icon: 'file' },
  { label: 'Revenue',    icon: 'bar'  },
];

function SidebarIcon({ icon }) {
  if (icon === 'grid') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
  if (icon === 'users') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
  if (icon === 'file') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}

function AdminSidebar({ active, onNav }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, height: '100vh', width: 220,
      background: '#0D1117', borderRight: '1px solid rgba(201,168,76,0.1)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 16px' }}>
        <div style={{
          color: '#C9A84C', fontWeight: 800, fontSize: '0.85rem',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          ⚙ Admin
        </div>
        <div style={{ color: '#8A9BB5', fontSize: '0.7rem', marginTop: 2 }}>
          MoneySorted
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(201,168,76,0.08)', margin: '0 14px' }}/>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {NAV.map(item => {
          const isActive = active === item.label;
          const isHov    = hovered === item.label;
          return (
            <button
              key={item.label}
              onClick={() => onNav(item.label)}
              onMouseEnter={() => setHovered(item.label)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: isActive ? '9px 12px 9px 14px' : '9px 12px 9px 16px',
                borderRadius: 10, fontSize: '0.875rem', fontWeight: 500,
                background: isActive ? 'rgba(201,168,76,0.1)' : isHov ? 'rgba(201,168,76,0.06)' : 'transparent',
                color: isActive ? '#C9A84C' : isHov ? '#F5F0E8' : '#8A9BB5',
                borderLeft: `2px solid ${isActive ? '#C9A84C' : 'transparent'}`,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                marginBottom: 2, boxSizing: 'border-box',
                transition: 'all 150ms ease',
              }}
            >
              <SidebarIcon icon={item.icon} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '12px 8px 20px' }}>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '9px 12px 9px 16px',
            borderRadius: 10, fontSize: '0.875rem', fontWeight: 500,
            background: 'transparent', color: '#8A9BB5',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            boxSizing: 'border-box', transition: 'color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8A9BB5'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 120 }) {
  return (
    <div style={{
      height: h, background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.08)', borderRadius: 14,
      animation: 'adm-pulse 1.5s ease-in-out infinite',
    }}/>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function DashboardSection({ data }) {
  const xTickFormatter = (v, i) => i % 5 === 0 ? fmtDateShort(v) : '';

  return (
    <>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 16, marginBottom: 24 }}>
        <KPI label="Total Users"           value={data.totalUsers}          sub="all time" />
        <KPI label="Uploads This Month"    value={data.statementsThisMonth} sub="current month" />
        <KPI label="Total Statements"      value={data.totalStatements}     sub="all time" />
        <KPI label="Paid Subscribers"      value={data.paidSubscribers}     sub="PRO + BUSINESS" />
      </div>

      {/* Daily Uploads Chart */}
      <Card title="Daily Uploads — Last 30 Days">
        <div style={{ padding: '20px 12px 12px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.dailyUploads} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#C9A84C" />
                  <stop offset="100%" stopColor="rgba(201,168,76,0.25)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A" vertical={false}/>
              <XAxis dataKey="date" tickFormatter={xTickFormatter} tick={{ fontSize: 11, fill: '#8A9BB5' }} axisLine={false} tickLine={false}/>
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8A9BB5' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip noun="uploads" />}/>
              <Bar dataKey="count" fill="url(#goldGrad)" radius={[4,4,0,0]} maxBarSize={40}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Daily Signups Chart */}
      <Card title="New Signups — Last 30 Days">
        <div style={{ padding: '20px 12px 12px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.dailySignups} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A" vertical={false}/>
              <XAxis dataKey="date" tickFormatter={xTickFormatter} tick={{ fontSize: 11, fill: '#8A9BB5' }} axisLine={false} tickLine={false}/>
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8A9BB5' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip noun="signups" />}/>
              <Line
                type="monotone" dataKey="count" stroke="#C9A84C" strokeWidth={2.5}
                dot={{ fill: '#C9A84C', r: 3, strokeWidth: 0 }}
                activeDot={{ fill: '#E8C97A', r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}

function UsersSection({ data }) {
  return (
    <Card title="Recent Users">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(201,168,76,0.05)' }}>
              {['Name', 'Email', 'Plan', 'Joined', 'Uploads'].map(col => (
                <th key={col} style={{
                  color: '#8A9BB5', fontSize: '0.68rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', padding: '10px 16px', textAlign: 'left',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recentUsers.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < data.recentUsers.length - 1 ? '1px solid rgba(30,42,58,0.4)' : 'none' }}>
                <td style={{ padding: '13px 16px', color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 600 }}>
                  {u.name || '—'}
                </td>
                <td style={{ padding: '13px 16px', color: '#8A9BB5', fontSize: '0.82rem' }}>
                  {u.email}
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <PlanBadge plan={u.plan} />
                </td>
                <td style={{ padding: '13px 16px', color: '#8A9BB5', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {fmtDate(u.createdAt)}
                </td>
                <td style={{ padding: '13px 16px', color: '#C9A84C', fontSize: '0.875rem', fontWeight: 600 }}>
                  {u.uploadCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatementsSection({ data }) {
  return (
    <Card title="Recent Uploads">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(201,168,76,0.05)' }}>
              {['Bank', 'Period', 'User', 'Uploaded', 'Txns', 'Confidence'].map(col => (
                <th key={col} style={{
                  color: '#8A9BB5', fontSize: '0.68rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', padding: '10px 16px', textAlign: 'left',
                  fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recentStatements.map((s, i) => {
              const conf = s.confidence;
              const confColor = conf == null ? '#8A9BB5' : conf >= 80 ? '#10B981' : conf >= 60 ? '#F59E0B' : '#EF4444';
              return (
                <tr key={s.id} style={{ borderBottom: i < data.recentStatements.length - 1 ? '1px solid rgba(30,42,58,0.4)' : 'none' }}>
                  <td style={{ padding: '13px 16px', color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 600 }}>
                    {s.bankName || '—'}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#8A9BB5', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {s.dateFrom ? `${s.dateFrom} – ${s.dateTo ?? '?'}` : '—'}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#8A9BB5', fontSize: '0.78rem' }}>
                    {s.userEmail}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#8A9BB5', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.createdAt)}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#C9A84C', fontSize: '0.875rem', fontWeight: 600 }}>
                    {s.transactionCount ?? '—'}
                  </td>
                  <td style={{ padding: '13px 16px', color: confColor, fontSize: '0.875rem', fontWeight: 600 }}>
                    {conf != null ? `${conf}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RevenueSection({ data }) {
  const proPct      = data.totalUsers > 0 ? ((data.paidSubscribers / data.totalUsers) * 100).toFixed(1) : 0;
  const estMonthly  = data.paidSubscribers * 4.99;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
        <KPI label="Paid Subscribers"   value={data.paidSubscribers} sub="PRO + BUSINESS" />
        <KPI label="Conversion Rate"    value={`${proPct}%`}         sub="of total users" />
        <KPI label="Est. MRR (PRO)"     value={`£${estMonthly.toFixed(0)}`} sub="at £4.99/user" />
        <KPI label="Free Users"         value={data.totalUsers - data.paidSubscribers} sub="on free plan" />
      </div>
      <UsersSection data={data} />
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [adminData, setAdminData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Access control
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || session?.user?.email !== ADMIN_EMAIL) {
      router.replace('/dashboard');
    }
  }, [status, session, router]);

  // Fetch admin data
  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.email !== ADMIN_EMAIL) return;
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setAdminData(d);
      })
      .catch(() => setError('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, [status, session]);

  if (status === 'loading' || (status === 'authenticated' && session?.user?.email !== ADMIN_EMAIL)) {
    return null;
  }

  const SIDEBAR_W = 220;

  function renderContent() {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            <Skeleton/><Skeleton/><Skeleton/><Skeleton/>
          </div>
          <Skeleton h={280}/>
          <Skeleton h={280}/>
        </div>
      );
    }
    if (error) {
      return <p style={{ color: '#EF4444' }}>{error}</p>;
    }
    if (!adminData) return null;

    if (activeNav === 'Dashboard')  return <DashboardSection data={adminData} />;
    if (activeNav === 'Users')      return <UsersSection     data={adminData} />;
    if (activeNav === 'Statements') return <StatementsSection data={adminData} />;
    if (activeNav === 'Revenue')    return <RevenueSection   data={adminData} />;
  }

  const titles = {
    Dashboard:  'Dashboard Overview',
    Users:      'All Users',
    Statements: 'All Statement Uploads',
    Revenue:    'Revenue & Subscribers',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#080C14', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes adm-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <AdminSidebar active={activeNav} onNav={setActiveNav} />

      {/* Main content */}
      <div style={{ marginLeft: SIDEBAR_W, minHeight: '100vh', padding: '32px 32px 48px' }}>
        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: '#C9A84C', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>
            Admin
          </p>
          <h1 style={{ color: '#F5F0E8', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {titles[activeNav]}
          </h1>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}
