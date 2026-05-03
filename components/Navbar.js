"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// ── Injected CSS (link hover + mobile only) ───────────────────────────────────
const NAVBAR_CSS = `
  .nlink {
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    padding: 7px 13px;
    border-radius: 20px;
    white-space: nowrap;
    color: #9CA3AF;
    transition: all 0.2s ease;
    display: inline-block;
    cursor: pointer;
  }
  .nlink:hover { color: #F5F0E8; background: rgba(255,255,255,0.06); }
  .nlink.active { color: #C9A84C; background: rgba(201,168,76,0.08); }

  .ntry {
    background: linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%);
    color: #080C14;
    font-size: 14px;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: 50px;
    border: none;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: all 0.2s ease;
    box-shadow: 0 4px 16px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .ntry:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(201,168,76,0.5), 0 0 0 3px rgba(201,168,76,0.12);
  }

  /* Mobile dropdown */
  .nav-mobile-menu { display: none; }
  .nav-desktop-links { display: flex; align-items: center; gap: 2px; }
  .nav-desktop-right { display: flex; align-items: center; gap: 8px; }

  .nav-hamburger {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    color: rgba(255,255,255,0.7);
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }
  .nav-hamburger:hover { color: #C9A84C; }

  .nav-mobile-link {
    display: flex; align-items: center;
    font-size: 0.9375rem; font-weight: 500;
    text-decoration: none;
    padding: 12px 14px; border-radius: 10px;
    color: rgba(255,255,255,0.65);
    min-height: 48px; width: 100%;
    transition: all 0.15s ease;
    background: transparent; border: none; cursor: pointer; text-align: left;
  }
  .nav-mobile-link:hover { background: rgba(255,255,255,0.05); color: #fff; }
  .nav-mobile-link.active { background: rgba(201,168,76,0.1); color: #C9A84C; font-weight: 600; }

  @media (max-width: 680px) {
    .nav-desktop-links { display: none !important; }
    .nav-desktop-right  { display: none !important; }
    .nav-hamburger      { display: flex !important; }
    .nav-mobile-menu    { display: block !important; }
  }
`;


// 3 nav links only — clean & focused
const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works", section: "how-it-works" },
  { label: "Pricing",      href: "#pricing",      section: "pricing"      },
];

export default function Navbar({ onScrollToUpload, onUploadAnother = null }) {
  const { data: session } = useSession();
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [mounted,       setMounted]       = useState(false);
  const wrapperRef = useRef(null);

  // ── CSS injection ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = "sf-navbar-css";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = NAVBAR_CSS;
    document.head.appendChild(el);
  }, []);

  // ── Fade in on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  // ── Scroll border ────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close menu on outside click ──────────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    const fn = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, [menuOpen]);

  // ── Active section ───────────────────────────────────────────────────────
  useEffect(() => {
    const sections = ["how-it-works", "pricing", "features", "security", "reviews"];
    const visible = new Set();
    const obs = [];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const o = new IntersectionObserver(
        ([e]) => { e.isIntersecting ? visible.add(id) : visible.delete(id); setActiveSection([...visible][0] ?? ""); },
        { rootMargin: "-20% 0px -60% 0px" }
      );
      o.observe(el); obs.push(o);
    });
    return () => obs.forEach((o) => o.disconnect());
  }, []);

  // ── Pill styles (all inline — no class dependency) ───────────────────────
  const pillStyle = {
    // Positioning — 16px gap from top edge for floating effect
    position:            "fixed",
    top:                 20,
    left:                "50%",
    transform:           "translateX(-50%)",
    zIndex:              99999,
    isolation:           "isolate",
    // Sizing — auto, NOT 100%
    width:               "auto",
    whiteSpace:          "nowrap",
    // Visual pill — frosted glass
    background:          "rgba(8,12,20,0.6)",
    backdropFilter:      "blur(24px) saturate(180%)",
    WebkitBackdropFilter:"blur(24px) saturate(180%)",
    border:              scrolled
                           ? "1px solid rgba(201,168,76,0.4)"
                           : "1px solid rgba(201,168,76,0.2)",
    borderRadius:        50,
    padding:             "10px 12px 10px 20px",
    display:             "flex",
    alignItems:          "center",
    gap:                 32,
    boxShadow:           "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
    // Mount fade
    opacity:             mounted ? 1 : 0,
    transition:          "opacity 0.35s ease, background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, border-radius 0.2s ease",
  };

  return (
    <div ref={wrapperRef} data-navbar style={pillStyle}>

      {/* Logo */}
      <Link
        href="/"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 0, lineHeight: 1 }}>
          <span style={{ fontFamily: "var(--font-playfair)", fontWeight: 700, fontSize: "22px", color: "#F5F0E8" }}>Money</span>
          <span style={{ fontFamily: "inherit", fontWeight: 300, fontSize: "22px", color: "#C9A84C", letterSpacing: "0.05em" }}>Sorted</span>
        </span>
      </Link>

      {/* Nav links — desktop */}
      <nav className="nav-desktop-links">
        {NAV_LINKS.map(({ label, href, section }) => (
          <a key={section} href={href} className={`nlink${activeSection === section ? " active" : ""}`}>
            {label}
          </a>
        ))}
        {/* Session link */}
        {session ? (
          <Link href="/dashboard" style={{ fontSize: "14px", fontWeight: 600, color: "#F59E0B", textDecoration: "none", whiteSpace: "nowrap", padding: "7px 4px" }}>
            My Dashboard →
          </Link>
        ) : (
          <Link href="/login" style={{ fontSize: "14px", fontWeight: 400, color: "#9CA3AF", textDecoration: "none", whiteSpace: "nowrap", padding: "7px 4px" }}>
            Sign In
          </Link>
        )}
      </nav>

      {/* Right: Try Free + hamburger */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="nav-desktop-right">
          {onUploadAnother ? (
            <button
              onClick={onUploadAnother}
              className="ntry"
            >
              Upload another
            </button>
          ) : (
            <button className="ntry" onClick={onScrollToUpload}>Try Free</button>
          )}
        </div>

        {/* Hamburger — mobile only */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? "Close menu" : "Open menu"}>
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown — absolutely positioned below pill */}
      {menuOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            position:    "absolute",
            top:         "calc(100% + 8px)",
            left:        0, right: 0,
            background:  "rgba(8,12,20,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:      "1px solid rgba(201,168,76,0.2)",
            borderRadius: 20,
            padding:     "8px 8px 12px",
            boxShadow:   "0 12px 40px rgba(0,0,0,0.5)",
            whiteSpace:  "normal",
          }}
        >
          {NAV_LINKS.map(({ label, href, section }) => (
            <a key={section} href={href} className={`nav-mobile-link${activeSection === section ? " active" : ""}`} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          {session ? (
            <>
              <Link href="/dashboard" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>My Dashboard →</Link>
              <button className="nav-mobile-link" onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}>Sign Out</button>
            </>
          ) : (
            <Link href="/login" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>Sign In</Link>
          )}
          <div style={{ padding: "8px 6px 0" }}>
            {onUploadAnother ? (
              <button className="ntry" style={{ width: "100%", borderRadius: 14, fontSize: "0.95rem", padding: "13px" }}
                onClick={() => { setMenuOpen(false); onUploadAnother(); }}>Upload another</button>
            ) : (
              <button className="ntry" style={{ width: "100%", borderRadius: 14, fontSize: "0.95rem", padding: "13px" }}
                onClick={() => { setMenuOpen(false); onScrollToUpload(); }}>Try Free</button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
