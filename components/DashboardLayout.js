'use client'

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

// ─── CSS injection for mobile/desktop responsive rules ───────────────────────

const STYLE_ID = 'sf-dashboard-layout-styles';

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 767px) {
      .sf-sidebar-desktop-spacer { display: none !important; }
      .sf-topbar-hamburger { display: flex !important; }
      .sf-main-content { padding: 16px !important; }
      .sf-mobile-logo { display: flex !important; }
    }
    @media (min-width: 768px) {
      .sf-topbar-hamburger { display: none !important; }
      .sf-mobile-logo { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// ─── DashboardLayout Component ───────────────────────────────────────────────

export default function DashboardLayout({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellHovered, setBellHovered] = useState(false);
  const [hamburgerHovered, setHamburgerHovered] = useState(false);

  const { data: session } = useSession();

  const userName = session?.user?.name || session?.user?.email || 'User';
  const userImage = session?.user?.image || null;
  const initials = (session?.user?.name || session?.user?.email || 'U')
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#080C14',
    }}>
      {/* Desktop sidebar spacer — pushes main content right on large screens */}
      <div
        className="sf-sidebar-desktop-spacer"
        style={{ width: 240, flexShrink: 0 }}
      />

      {/* Sidebar — always rendered; handles its own mobile slide transform */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>

        {/* ── Top Bar ── */}
        <header style={{
          background: '#080C14',
          borderBottom: '1px solid rgba(201,168,76,0.08)',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
        }}>

          {/* Left side */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Hamburger — hidden on desktop via injected CSS, flex on mobile */}
            <button
              className="sf-topbar-hamburger"
              onClick={() => setSidebarOpen(true)}
              style={{
                display: 'none', // overridden to flex by injected CSS on mobile
                background: 'none',
                border: 'none',
                color: hamburgerHovered ? '#F5F0E8' : '#8A9BB5',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                marginRight: 8,
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
                outline: 'none',
              }}
              onMouseEnter={() => setHamburgerHovered(true)}
              onMouseLeave={() => setHamburgerHovered(false)}
              aria-label="Open sidebar"
            >
              <MenuIcon />
            </button>

            {/* Page title */}
            {title && (
              <h1 style={{
                color: '#F5F0E8',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                margin: 0,
              }}>
                {title}
              </h1>
            )}
          </div>

          {/* Mobile-only centred logo */}
          <div
            className="sf-mobile-logo"
            style={{
              display: 'none', // shown on mobile via injected CSS
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              background: 'linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <rect x="1"  y="11" width="3" height="6"  rx="1" fill="#080C14" fillOpacity="0.55"/>
                <rect x="6"  y="7"  width="3" height="10" rx="1" fill="#080C14" fillOpacity="0.75"/>
                <rect x="11" y="3"  width="3" height="14" rx="1" fill="#080C14"/>
                <path d="M2.5 10.5 C5.5 6 9 6.5 12.5 2.5" stroke="#080C14" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
                <path d="M10.5 1.5 L13 2.5 L12 5" stroke="#080C14" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span style={{ color: '#F5F0E8', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.02em' }}>
              StatementFlow
            </span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Bell button */}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: bellHovered ? '#F5F0E8' : '#8A9BB5',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
                outline: 'none',
                position: 'relative',
              }}
              onMouseEnter={() => setBellHovered(true)}
              onMouseLeave={() => setBellHovered(false)}
              aria-label="Notifications"
            >
              <BellIcon />
            </button>

            {/* User avatar — links to /account */}
            <Link
              href="/account"
              style={{
                width: 36,
                height: 36,
                minWidth: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                flexShrink: 0,
                overflow: 'hidden',
              }}
              aria-label="Account"
            >
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName}
                  width={36}
                  height={36}
                  style={{ borderRadius: '50%', objectFit: 'cover', width: 36, height: 36 }}
                />
              ) : (
                <span style={{
                  color: '#080C14',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  {initials}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* ── Page Content ── */}
        <div className="sf-main-content" style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
        }}>
          {children}
        </div>
      </main>
    </div>
  );
}
