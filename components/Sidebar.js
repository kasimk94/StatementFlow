'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

// ─── Streak helpers ───────────────────────────────────────────────────────────

function computeStreak(statements) {
  if (!statements || statements.length === 0) return 0;
  const uploaded = new Set();
  statements.forEach(s => {
    const d = new Date(s.createdAt);
    if (!isNaN(d)) uploaded.add(`${d.getFullYear()}-${d.getMonth()}`);
  });
  const now = new Date();
  let yr = now.getFullYear(), mo = now.getMonth(), count = 0;
  while (count < 120) {
    if (!uploaded.has(`${yr}-${mo}`)) break;
    count++;
    if (--mo < 0) { mo = 11; yr--; }
  }
  return count;
}

// ─── Logo Icon ───────────────────────────────────────────────────────────────


// ─── Inline SVG Icons ────────────────────────────────────────────────────────

const Icons = {
  LayoutDashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  FileText: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  List: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  BarChart2: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  Download: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Star: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Menu: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  ),
  User: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Target: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
      <path d="M5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75z"/>
      <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/>
    </svg>
  ),
};

// ─── Nav Structure ───────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    section: 'OVERVIEW',
    items: [
      { label: 'Dashboard',     icon: 'LayoutDashboard', href: '/dashboard' },
      { label: 'My Statements', icon: 'FileText',        href: '/statements' },
      { label: 'Transactions',  icon: 'List',            href: '/transactions' },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { label: 'Insights', icon: 'Sparkles', href: '/insights' },
      { label: 'Budget',   icon: 'Target',   href: '/budget' },
      { label: 'Reports',  icon: 'BarChart2', href: '/reports' },
      { label: 'Export',   icon: 'Download',  href: '/export' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { label: 'Settings', icon: 'Settings', href: '/account' },
    ],
  },
];

// ─── Plan Badge ──────────────────────────────────────────────────────────────

function PlanBadge({ plan }) {
  const styles = {
    FREE: {
      background: '#1E2A3A',
      color: '#8A9BB5',
    },
    PRO: {
      background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
      color: '#080C14',
    },
    BUSINESS: {
      background: 'linear-gradient(135deg, #818CF8, #6366f1)',
      color: '#ffffff',
    },
  };
  const s = styles[plan] || styles.FREE;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      ...s,
    }}>
      {plan}
    </span>
  );
}

// ─── Sidebar Inner Content ───────────────────────────────────────────────────

function SidebarContent({ isOpen, onClose }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const plan = session?.user?.plan || 'FREE';

  const [hoveredItem, setHoveredItem] = useState(null);
  const [signOutHovered, setSignOutHovered] = useState(false);
  const [upgradeHovered, setUpgradeHovered] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch('/api/statements')
      .then(r => r.json())
      .then(d => setStreak(computeStreak(d.statements ?? [])))
      .catch(() => {});
  }, [session?.user?.id]);

  const isActive = (href) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  // Determine sidebar transform based on screen size + open state
  // We use a CSS class injected once into the document head for media queries
  // but we also track isMobile via a state to handle the transform properly.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const sidebarTransform = isMobile
    ? (isOpen ? 'translateX(0)' : 'translateX(-100%)')
    : 'translateX(0)';

  // Derive user display info
  const userName = session?.user?.name || session?.user?.email || 'User';
  const userEmail = session?.user?.email || '';
  const userImage = session?.user?.image || null;
  const initials = (session?.user?.name || session?.user?.email || 'U')
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <style>{`
        .sf-sidebar-nav::-webkit-scrollbar { width: 3px; }
        .sf-sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        .sf-sidebar-nav::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.18); border-radius: 999px; }
        .sf-sidebar-nav::-webkit-scrollbar-thumb:hover { background: rgba(201,168,76,0.38); }
        .sf-sidebar-nav { scrollbar-width: thin; scrollbar-color: rgba(201,168,76,0.18) transparent; }
      `}</style>
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh',
      width: 240,
      background: '#0D1117',
      borderRight: '1px solid rgba(201,168,76,0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      transition: 'transform 0.25s ease',
      transform: sidebarTransform,
    }}>

      {/* ── Top: Logo ── */}
      <div style={{ padding: '20px 16px 16px' }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 0, lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--font-playfair)', fontWeight: 700, fontSize: '22px', color: '#F5F0E8' }}>Money</span>
            <span style={{ fontFamily: 'inherit', fontWeight: 300, fontSize: '22px', color: '#C9A84C', letterSpacing: '0.05em' }}>Sorted</span>
          </span>
        </Link>
      </div>

      {/* ── Divider ── */}
      <div style={{
        height: 1,
        background: 'rgba(201,168,76,0.08)',
        margin: '0 16px',
      }} />

      {/* ── Nav Sections ── */}
      <nav className="sf-sidebar-nav" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 8px',
      }}>
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.section}>
            {/* Section label */}
            <div style={{
              color: '#8A9BB5',
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: sectionIdx === 0 ? '8px 8px 6px' : '16px 8px 6px',
            }}>
              {section.section}
            </div>

            {/* Section items */}
            {section.items.map((item) => {
              const active = isActive(item.href);
              const hovered = hoveredItem === `${section.section}-${item.label}`;
              const IconComponent = Icons[item.icon];

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: active
                      ? '9px 12px 9px 14px'
                      : '9px 12px 9px 16px',
                    borderRadius: 10,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    borderLeft: active
                      ? '2px solid #C9A84C'
                      : '2px solid transparent',
                    color: active
                      ? '#C9A84C'
                      : hovered
                        ? '#F5F0E8'
                        : '#8A9BB5',
                    background: active
                      ? 'rgba(201,168,76,0.1)'
                      : hovered
                        ? 'rgba(201,168,76,0.06)'
                        : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 2,
                  }}
                  onMouseEnter={() =>
                    setHoveredItem(`${section.section}-${item.label}`)
                  }
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {IconComponent ? <IconComponent /> : null}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* After ACCOUNT section items, add Upgrade + Sign Out */}
            {section.section === 'ACCOUNT' && (
              <>
                {/* Upgrade to Pro (only for FREE plan) */}
                {plan === 'FREE' && (
                  <Link
                    href="/account#upgrade"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px 9px 14px',
                      borderRadius: 10,
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      borderLeft: '2px solid rgba(201,168,76,0.3)',
                      color: '#C9A84C',
                      background: upgradeHovered
                        ? 'rgba(201,168,76,0.12)'
                        : 'rgba(201,168,76,0.06)',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginBottom: 2,
                      boxShadow: '0 0 12px rgba(201,168,76,0.08)',
                    }}
                    onMouseEnter={() => setUpgradeHovered(true)}
                    onMouseLeave={() => setUpgradeHovered(false)}
                  >
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <Icons.Star />
                    </span>
                    <span>Upgrade to Pro</span>
                  </Link>
                )}

                {/* Sign Out */}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px 9px 16px',
                    borderRadius: 10,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    borderLeft: '2px solid transparent',
                    color: signOutHovered ? '#EF4444' : '#8A9BB5',
                    background: signOutHovered
                      ? 'rgba(239,68,68,0.06)'
                      : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 2,
                    border: 'none',
                    borderLeft: '2px solid transparent',
                    outline: 'none',
                  }}
                  onMouseEnter={() => setSignOutHovered(true)}
                  onMouseLeave={() => setSignOutHovered(false)}
                >
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <Icons.LogOut />
                  </span>
                  <span>Sign Out</span>
                </button>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* ── Bottom User Card ── */}
      <div style={{
        borderTop: '1px solid rgba(201,168,76,0.08)',
        padding: '12px 16px 16px',
      }}>
        <Link
          href="/account"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {userImage ? (
              <img
                src={userImage}
                alt={userName}
                width={36}
                height={36}
                style={{ borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{
                color: '#080C14',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}>
                {initials}
              </span>
            )}
          </div>

          {/* Name + Plan + Streak */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              color: '#F5F0E8',
              fontSize: '0.82rem',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 120,
              marginBottom: 3,
            }}>
              {userName}
            </div>
            <PlanBadge plan={plan} />
            <div style={{ marginTop: 5, fontSize: '0.68rem', color: streak >= 2 ? '#C9A84C' : '#4A5568', lineHeight: 1.3 }}>
              {streak >= 2
                ? `🔥 ${streak} month streak — keep it up!`
                : 'Upload monthly for streak insights'}
            </div>
          </div>
        </Link>
      </div>
    </div>
    </>
  );
}

// ─── useSidebar Hook ─────────────────────────────────────────────────────────

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

// ─── Sidebar Component ───────────────────────────────────────────────────────

export default function Sidebar({ isOpen, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
        />
      )}

      {/* Sidebar panel */}
      <SidebarContent isOpen={isOpen} onClose={onClose} />
    </>
  );
}
