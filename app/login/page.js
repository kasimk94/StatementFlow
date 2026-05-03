"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  pageBg:  "#080C14",
  cardBg:  "#0D1117",
  border:  "rgba(201,168,76,0.15)",
  gold:    "#C9A84C",
  goldLt:  "#E8C97A",
  textPri: "#F5F0E8",
  textSec: "#8A9BB5",
};

// ── LogoIcon ──────────────────────────────────────────────────────────────────
function LogoIcon({ size = 28 }) {
  const r = Math.round(size * 0.25);
  const s = Math.round(size * 0.56);
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(201,168,76,0.35)",
    }}>
      <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
        <rect x="1"  y="11" width="3" height="6"  rx="1" fill="#080C14" fillOpacity="0.55"/>
        <rect x="6"  y="7"  width="3" height="10" rx="1" fill="#080C14" fillOpacity="0.75"/>
        <rect x="11" y="3"  width="3" height="14" rx="1" fill="#080C14"/>
        <path d="M2.5 10.5 C5.5 6 9 6.5 12.5 2.5" stroke="#080C14" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        <path d="M10.5 1.5 L13 2.5 L12 5" stroke="#080C14" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );
}

// ── Eye icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Shared right panel ────────────────────────────────────────────────────────
function RightPanel() {
  const features = [
    {
      label: "Upload any UK bank PDF",
      desc:  "Barclays, HSBC, Monzo, Starling and more",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 13V3M6 7l4-4 4 4" stroke={T.gold} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 16h14" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: "Instant spending insights",
      desc:  "Dashboard, categories and merchant breakdown",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2"  y="11" width="3" height="7" rx="1" fill={T.gold} fillOpacity="0.75"/>
          <rect x="8"  y="7"  width="3" height="11" rx="1" fill={T.gold}/>
          <rect x="14" y="3"  width="3" height="15" rx="1" fill={T.gold}/>
        </svg>
      ),
    },
    {
      label: "Full statement history",
      desc:  "Every upload saved and always accessible",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke={T.gold} strokeWidth="1.8"/>
          <path d="M10 6v4l2.5 2.5" stroke={T.gold} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: "One-click Excel & CSV export",
      desc:  "Ready for your accountant in seconds",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3v10M6 9l4 4 4-4" stroke={T.gold} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 16h14" stroke={T.gold} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      background: T.cardBg,
      borderRadius: 24,
      margin: "24px 24px 24px 0",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      height: "calc(100vh - 48px)",
    }}>
      {/* Top-right radial glow */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 300, height: 300, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)",
      }} />

      <div style={{ padding: 48, position: "relative" }}>
        <h2 style={{
          color: T.textPri, fontSize: "1.5rem", fontWeight: 700,
          letterSpacing: "-0.02em", margin: "0 0 8px 0",
        }}>
          Everything in one place
        </h2>
        <p style={{ color: T.textSec, fontSize: "0.9rem", margin: "0 0 40px 0" }}>
          Join thousands of UK users who trust MoneySorted
        </p>

        {features.map((f) => (
          <div key={f.label}
            style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 40, height: 40, flexShrink: 0, borderRadius: 10,
              background: "rgba(201,168,76,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 600, fontSize: "0.95rem" }}>
                {f.label}
              </div>
              <div style={{ color: T.textSec, fontSize: "0.82rem", marginTop: 2 }}>
                {f.desc}
              </div>
            </div>
          </div>
        ))}

        <div style={{ height: 1, background: "rgba(201,168,76,0.1)", margin: "32px 0" }} />

        <p style={{
          color: T.textSec, fontSize: "0.875rem", fontStyle: "italic",
          lineHeight: 1.6, margin: "0 0 8px 0",
        }}>
          &ldquo;Finally a tool that just works. My Barclays statement was processed in seconds.&rdquo;
        </p>
        <p style={{ color: T.textPri, fontSize: "0.8rem", fontWeight: 500, margin: 0 }}>
          — Sarah M., London
        </p>
      </div>
    </div>
  );
}

// ── LoginPageInner ────────────────────────────────────────────────────────────
function LoginPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || "/statements";

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocus,   setEmailFocus]   = useState(false);
  const [passFocus,    setPassFocus]    = useState(false);
  const [gBtnHover,    setGBtnHover]    = useState(false);
  const [btnHover,     setBtnHover]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    } else {
      router.push(callbackUrl);
    }
  }

  const inputBase = {
    background: T.cardBg,
    color: T.textPri,
    padding: "12px 14px",
    borderRadius: 10,
    width: "100%",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <>
      {/* Responsive: hide right col, full-width left col on mobile */}
      <style>{`
        @media (max-width: 767px) {
          .sf-right-col { display: none !important; }
          .sf-left-col  { width: 100% !important; padding: 24px !important; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: T.pageBg,
        display: "flex",
        flexDirection: "row",
      }}>
        {/* ════════════════ LEFT COLUMN ════════════════ */}
        <div
          className="sf-left-col"
          style={{
            width: "55%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            padding: "40px 48px",
            boxSizing: "border-box",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoIcon size={32} />
            <span style={{ color: "#fff", fontSize: "1rem", fontWeight: 700 }}>
              MoneySorted
            </span>
          </div>

          {/* Centred form */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 420,
            width: "100%",
            margin: "0 auto",
          }}>
            <h1 style={{
              color: T.textPri,
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 8px 0",
            }}>
              Welcome back
            </h1>
            <p style={{ color: T.textSec, fontSize: "1rem", margin: "0 0 32px 0" }}>
              Sign in to your account
            </p>

            {/* Error box */}
            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#EF4444",
                fontSize: "0.875rem",
                marginBottom: 20,
              }}>
                {error}
              </div>
            )}

            {/* Google button */}
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/statements" })}
              onMouseEnter={() => setGBtnHover(true)}
              onMouseLeave={() => setGBtnHover(false)}
              style={{
                width: "100%",
                background: T.cardBg,
                border: gBtnHover
                  ? "1px solid rgba(201,168,76,0.7)"
                  : "1px solid rgba(201,168,76,0.3)",
                boxShadow: gBtnHover ? "0 0 0 3px rgba(201,168,76,0.08)" : "none",
                color: T.textPri,
                padding: "13px",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontSize: "0.95rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
                marginBottom: 24,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 24,
            }}>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <span style={{ color: T.textSec, fontSize: "0.8rem" }}>
                or continue with email
              </span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
              {/* Email field */}
              <div style={{ marginBottom: 18 }}>
                <label style={{
                  color: T.textSec, fontSize: "0.8rem", fontWeight: 500,
                  display: "block", marginBottom: 6,
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  style={{
                    ...inputBase,
                    border: emailFocus
                      ? "1px solid rgba(201,168,76,0.6)"
                      : `1px solid ${T.border}`,
                  }}
                />
              </div>

              {/* Password field */}
              <div style={{ marginBottom: 0 }}>
                <label style={{
                  color: T.textSec, fontSize: "0.8rem", fontWeight: 500,
                  display: "block", marginBottom: 6,
                }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    onFocus={() => setPassFocus(true)}
                    onBlur={() => setPassFocus(false)}
                    style={{
                      ...inputBase,
                      padding: "12px 44px 12px 14px",
                      border: passFocus
                        ? "1px solid rgba(201,168,76,0.6)"
                        : `1px solid ${T.border}`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: T.textSec,
                      display: "flex",
                      alignItems: "center",
                      padding: 0,
                    }}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <a
                href="/forgot-password"
                style={{
                  color: T.gold,
                  fontSize: "0.8rem",
                  textDecoration: "none",
                  display: "block",
                  textAlign: "right",
                  marginTop: 6,
                  marginBottom: 24,
                }}
              >
                Forgot password?
              </a>

              {/* Sign in button */}
              <button
                type="submit"
                disabled={loading}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
                  color: "#080C14",
                  fontWeight: 700,
                  fontSize: "1rem",
                  padding: "13px",
                  borderRadius: 50,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 20px rgba(201,168,76,0.35)",
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity 0.15s, filter 0.15s",
                  filter: btnHover && !loading ? "brightness(1.08)" : "none",
                }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Bottom link */}
            <p style={{
              color: T.textSec, fontSize: "0.875rem",
              marginTop: 28, textAlign: "center",
            }}>
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                style={{ color: T.gold, fontWeight: 600, textDecoration: "none" }}
              >
                Create free account
              </Link>
            </p>
          </div>
        </div>

        {/* ════════════════ RIGHT COLUMN ════════════════ */}
        <div className="sf-right-col" style={{ flex: 1 }}>
          <RightPanel />
        </div>
      </div>
    </>
  );
}

// ── Default export wrapped in Suspense (required for useSearchParams) ─────────
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
