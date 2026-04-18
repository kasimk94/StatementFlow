"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// ── Injected CSS ──────────────────────────────────────────────────────────────
const NAVBAR_CSS = `
  .npill {
    position: relative;
    z-index: 1;
    font-size: 0.9rem;
    font-weight: 500;
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 8px;
    white-space: nowrap;
    color: #8A9BB5;
    transition: color 0.2s ease;
    display: inline-block;
    cursor: pointer;
  }

  .ntry {
    background: linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%);
    color: #080C14;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 9px 20px;
    border-radius: 50px;
    border: none;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: all 0.2s ease;
    box-shadow: 0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
    min-height: 36px;
    white-space: nowrap;
  }
  .ntry:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 28px rgba(201,168,76,0.5);
  }

  /* Desktop nav — hidden on mobile */
  .nav-links-desktop {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  /* Try Free button — hidden on mobile */
  .nav-tryfree-desktop {
    display: inline-flex;
    align-items: center;
  }
  /* Hamburger — hidden on desktop */
  .nav-hamburger {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    color: #8A9BB5;
    line-height: 1;
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
    flex-shrink: 0;
  }
  .nav-hamburger:hover { background: rgba(201,168,76,0.12); color: #F5F0E8; }

  /* Mobile dropdown — hidden on desktop */
  .nav-mobile-menu {
    display: none;
  }

  @media (max-width: 768px) {
    .nav-links-desktop  { display: none !important; }
    .nav-tryfree-desktop { display: none !important; }
    .nav-hamburger      { display: flex !important; }
    .nav-mobile-menu    { display: block !important; }
    .nav-wrapper-outer  { width: calc(100% - 24px) !important; max-width: calc(100% - 24px) !important; }
  }

  /* Mobile menu link */
  .nav-mobile-link {
    display: flex;
    align-items: center;
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
    padding: 13px 16px;
    border-radius: 10px;
    color: #8A9BB5;
    min-height: 48px;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .nav-mobile-link:hover,
  .nav-mobile-link:active {
    background: rgba(201,168,76,0.1);
    color: #C9A84C;
  }
  .nav-mobile-link.active {
    background: rgba(201,168,76,0.12);
    color: #C9A84C;
    font-weight: 600;
  }
`;

// ── Logo ──────────────────────────────────────────────────────────────────────
function LogoIcon({ size = 32 }) {
  const r = Math.round(size * 0.25);
  const s = Math.round(size * 0.56);
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(201,168,76,0.4)",
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

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works", section: "how-it-works" },
  { label: "Pricing",      href: "#pricing",      section: "pricing"      },
  { label: "Features",     href: "#features",     section: "features"     },
  { label: "Reviews",      href: "#reviews",      section: "reviews"      },
  { label: "Security",     href: "#security",     section: "security"     },
];

export default function Navbar({ onScrollToUpload, onUploadAnother = null, showReviewsLink = false }) {
  const visibleLinks = showReviewsLink
    ? NAV_LINKS
    : NAV_LINKS.filter((l) => l.section !== "reviews");

  const { data: session } = useSession();
  const [topPx,         setTopPx]         = useState(-110);
  const [easing,        setEasing]        = useState("top 0.65s cubic-bezier(0.34,1.56,0.64,1)");
  const [activeSection, setActiveSection] = useState("");
  const [hoveredIdx,    setHoveredIdx]    = useState(null);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);

  const [pill, setPill] = useState({ left: 0, width: 0, opacity: 0 });

  const navRef       = useRef(null);
  const linkRefs     = useRef([]);
  const wrapperRef   = useRef(null);
  const hasMounted   = useRef(false);
  const lastScrollY  = useRef(0);
  const hoverTopRef  = useRef(false);
  const hideTimerRef = useRef(null);

  // ── Inject CSS once ───────────────────────────────────────────────────────
  useEffect(() => {
    const id = "navbar-pill-css";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = NAVBAR_CSS;
    document.head.appendChild(el);
  }, []);

  // ── Close menu on outside click ───────────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  // Close menu on resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Sliding pill ──────────────────────────────────────────────────────────
  const activeIdx = visibleLinks.findIndex((l) => l.section === activeSection);
  const targetIdx = hoveredIdx !== null ? hoveredIdx : activeIdx;

  const movePill = useCallback((idx) => {
    const el = linkRefs.current[idx];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth, opacity: 1 });
  }, []);

  const hidePill = useCallback(() => {
    setPill((p) => ({ ...p, opacity: 0 }));
  }, []);

  useEffect(() => {
    if (targetIdx < 0) { hidePill(); } else { movePill(targetIdx); }
  }, [targetIdx, movePill, hidePill]);

  useEffect(() => {
    function onResize() { if (targetIdx >= 0) movePill(targetIdx); }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [targetIdx, movePill]);

  // ── Drop-in on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => {
      setTopPx(12);
      const t2 = setTimeout(() => {
        setEasing("top 0.3s ease");
        hasMounted.current = true;
      }, 750);
      return () => clearTimeout(t2);
    }, 180);
    return () => clearTimeout(t1);
  }, []);

  // ── Show/hide on scroll + mouse-at-top ────────────────────────────────────
  useEffect(() => {
    function show() { setTopPx(12); }
    function hide() { setTopPx(-110); }

    function handleScroll() {
      if (!hasMounted.current) return;
      const y = window.scrollY;
      setScrolled(y > 80);
      if (y <= 0) { show(); }
      else if (!hoverTopRef.current && y > lastScrollY.current + 4) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hide();
      } else if (y < lastScrollY.current - 4) { show(); }
      lastScrollY.current = y;
    }

    function handleMouseMove(e) {
      if (!hasMounted.current) return;
      if (e.clientY < 60) {
        if (!hoverTopRef.current) {
          hoverTopRef.current = true;
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          show();
        }
      } else {
        if (hoverTopRef.current) {
          hoverTopRef.current = false;
          if (window.scrollY > 100) hideTimerRef.current = setTimeout(hide, 1500);
        }
      }
    }

    window.addEventListener("scroll",      handleScroll,    { passive: true });
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("scroll",      handleScroll);
      document.removeEventListener("mousemove", handleMouseMove);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ── Active section via IntersectionObserver ───────────────────────────────
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.section);
    const visible = new Set();
    const observers = [];

    function pick() {
      for (const id of ids) {
        if (visible.has(id)) { setActiveSection(id); return; }
      }
      setActiveSection("");
    }

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { entry.isIntersecting ? visible.add(id) : visible.delete(id); pick(); },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapperRef}
      className="nav-wrapper-outer"
      style={{
        position:            "fixed",
        top:                 topPx,
        left:                "50%",
        transform:           "translateX(-50%)",
        width:               "fit-content",
        maxWidth:            "min(900px, calc(100% - 24px))",
        overflow:            "hidden",
        zIndex:              1000,
        transition:          easing,
        borderRadius:        menuOpen ? "50px 50px 20px 20px" : 50,
        background:          "rgba(8,12,20,0.85)",
        backdropFilter:      "blur(20px)",
        WebkitBackdropFilter:"blur(20px)",
        boxShadow:           "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.08)",
        border:              scrolled ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(201,168,76,0.12)",
        borderBottom:        scrolled ? "1px solid rgba(201,168,76,0.5)" : "1px solid rgba(201,168,76,0.12)",
        padding:             menuOpen ? 0 : 0,
      }}
    >
      {/* ── Pill header row ── */}
      <header
        style={{
          borderRadius:  menuOpen ? "50px 50px 0 0" : 50,
          height:        52,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"space-between",
          padding:       "0 16px 0 20px",
          gap:           12,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}
        >
          <LogoIcon size={30} />
          <div>
            <span style={{
              fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #F5F0E8 0%, #E8C97A 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              display: "block",
            }}>
              StatementFlow
            </span>
          </div>
        </Link>

        {/* Desktop nav links with sliding pill */}
        <nav
          ref={navRef}
          className="nav-links-desktop"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute", top: "50%", transform: "translateY(-50%)",
              height: 34, left: pill.left, width: pill.width,
              background: "rgba(201,168,76,0.12)", borderRadius: 10, opacity: pill.opacity,
              transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
              pointerEvents: "none",
            }}
          />
          {visibleLinks.map(({ label, href, section }, i) => {
            const isActive  = activeSection === section;
            const highlight = isActive || hoveredIdx === i;
            return (
              <a
                key={section}
                href={href}
                ref={(el) => { linkRefs.current[i] = el; }}
                className="npill"
                style={{ color: highlight ? "#C9A84C" : "#8A9BB5", fontWeight: isActive ? 600 : 500 }}
                onMouseEnter={() => setHoveredIdx(i)}
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Auth buttons — desktop only */}
          <div className="nav-tryfree-desktop" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {session ? (
              <>
                <Link
                  href="/account"
                  style={{
                    fontSize: "0.85rem", fontWeight: 600, color: "#8A9BB5",
                    textDecoration: "none", padding: "6px 12px", borderRadius: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  {session.user?.name?.split(" ")[0] || "Account"}
                </Link>
                {onUploadAnother ? (
                  <button
                    onClick={onUploadAnother}
                    style={{
                      background: "transparent", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)",
                      borderRadius: 999, padding: "8px 18px", fontSize: "0.85rem", fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,168,76,0.12)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Upload another
                  </button>
                ) : (
                  <button className="ntry" onClick={onScrollToUpload}>Try Free</button>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  style={{
                    fontSize: "0.85rem", fontWeight: 600, color: "#8A9BB5",
                    textDecoration: "none", padding: "6px 12px", borderRadius: 8,
                    whiteSpace: "nowrap",
                  }}
                >
                  Log in
                </Link>
                {onUploadAnother ? (
                  <button
                    onClick={onUploadAnother}
                    style={{
                      background: "transparent", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)",
                      borderRadius: 999, padding: "8px 18px", fontSize: "0.85rem", fontWeight: 600,
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,168,76,0.12)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Upload another
                  </button>
                ) : (
                  <button className="ntry" onClick={onScrollToUpload}>Try Free</button>
                )}
              </>
            )}
          </div>
          {/* Hamburger — mobile only */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6"  y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6"  />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile dropdown ── */}
      <div
        className="nav-mobile-menu"
        style={{
          overflow:            "hidden",
          maxHeight:           menuOpen ? 520 : 0,
          transition:          "max-height 0.3s ease",
          background:          "rgba(10,14,24,0.97)",
          backdropFilter:      "blur(16px)",
          WebkitBackdropFilter:"blur(16px)",
          borderRadius:        "0 0 24px 24px",
          borderTop:           "1px solid rgba(30,42,58,0.8)",
        }}
      >
        <nav style={{ padding: "6px 10px 14px" }}>
          {visibleLinks.map(({ label, href, section }) => (
            <a
              key={section}
              href={href}
              className={`nav-mobile-link${activeSection === section ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
          <div style={{ padding: "8px 6px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
            {session ? (
              <>
                <Link
                  href="/account"
                  className="nav-mobile-link"
                  onClick={() => setMenuOpen(false)}
                >
                  My Account
                </Link>
                <button
                  style={{ width: "100%", borderRadius: 999, fontSize: "0.9rem", fontWeight: 600, padding: "13px", background: "transparent", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)", cursor: "pointer" }}
                  onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="nav-mobile-link"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  style={{ width: "100%", display: "block", textAlign: "center", borderRadius: 12, fontSize: 15, padding: "13px", background: "#C9A84C", color: "#080C14", fontWeight: 700, textDecoration: "none", boxShadow: "0 0 16px rgba(201,168,76,0.3)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  Sign up free
                </Link>
              </>
            )}
            {onUploadAnother ? (
              <button
                style={{ width: "100%", borderRadius: 999, fontSize: "0.9rem", fontWeight: 600, padding: "13px", background: "transparent", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)", cursor: "pointer" }}
                onClick={() => { setMenuOpen(false); onUploadAnother(); }}
              >
                Upload another
              </button>
            ) : (
              <button
                className="ntry"
                style={{ width: "100%", borderRadius: 12, fontSize: 15, padding: "13px" }}
                onClick={() => { setMenuOpen(false); onScrollToUpload(); }}
              >
                Try Free
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
