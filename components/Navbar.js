"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ── Injected CSS ──────────────────────────────────────────────────────────────
const NAVBAR_CSS = `
  @keyframes navBorderGlow {
    0%   { background-position: 0%   50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0%   50%; }
  }

  /* Nav link — no background here; the sliding pill handles that */
  .npill {
    position: relative;
    z-index: 1;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 8px;
    white-space: nowrap;
    color: #4a4a6a;
    transition: color 0.2s ease, font-weight 0s;
    display: inline-block;
    cursor: pointer;
  }

  /* Try Free button */
  .ntry {
    background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #00d4ff 100%);
    background-size: 200% 200%;
    background-position: 0% 50%;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    padding: 9px 22px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(108, 92, 231, 0.25);
  }
  .ntry:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(108, 92, 231, 0.4);
    background-position: 100% 50%;
  }
`;

// ── Logo ──────────────────────────────────────────────────────────────────────
function LogoIcon({ size = 32 }) {
  const r = Math.round(size * 0.25);
  const s = Math.round(size * 0.56);
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
    }}>
      <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
        <rect x="1"  y="11" width="3" height="6"  rx="1" fill="white" fillOpacity="0.65"/>
        <rect x="6"  y="7"  width="3" height="10" rx="1" fill="white" fillOpacity="0.85"/>
        <rect x="11" y="3"  width="3" height="14" rx="1" fill="white"/>
        <path d="M2.5 10.5 C5.5 6 9 6.5 12.5 2.5"
          stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        <path d="M10.5 1.5 L13 2.5 L12 5"
          stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
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

export default function Navbar({ onScrollToUpload }) {
  const [topPx,         setTopPx]         = useState(-110);
  const [easing,        setEasing]        = useState("top 0.65s cubic-bezier(0.34,1.56,0.64,1)");
  const [activeSection, setActiveSection] = useState("");
  const [hoveredIdx,    setHoveredIdx]    = useState(null);

  // Sliding pill geometry
  const [pill, setPill] = useState({ left: 0, width: 0, opacity: 0 });

  const navRef        = useRef(null);
  const linkRefs      = useRef([]);    // one ref per nav link
  const hasMounted    = useRef(false);
  const lastScrollY   = useRef(0);
  const hoverTopRef   = useRef(false);
  const hideTimerRef  = useRef(null);

  // ── Inject CSS once ───────────────────────────────────────────────────────
  useEffect(() => {
    const id = "navbar-pill-css";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = NAVBAR_CSS;
    document.head.appendChild(el);
  }, []);

  // ── Sliding pill position ─────────────────────────────────────────────────
  const activeIdx = NAV_LINKS.findIndex((l) => l.section === activeSection);
  // Hovered takes priority; fall back to active; -1 means no pill
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
    if (targetIdx < 0) {
      hidePill();
    } else {
      movePill(targetIdx);
    }
  }, [targetIdx, movePill, hidePill]);

  // Recalculate on resize so pill stays aligned
  useEffect(() => {
    function onResize() {
      if (targetIdx >= 0) movePill(targetIdx);
    }
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [targetIdx, movePill]);

  // ── Drop-in on first load ─────────────────────────────────────────────────
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

  // ── Scroll + hover-at-top show/hide ───────────────────────────────────────
  useEffect(() => {
    function show() { setTopPx(12); }
    function hide() { setTopPx(-110); }

    function handleScroll() {
      if (!hasMounted.current) return;
      const y = window.scrollY;
      if (y <= 0) {
        show();
      } else if (!hoverTopRef.current && y > lastScrollY.current + 4) {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hide();
      } else if (y < lastScrollY.current - 4) {
        show();
      }
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
          if (window.scrollY > 100) {
            hideTimerRef.current = setTimeout(hide, 1500);
          }
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
      style={{
        position:   "fixed",
        top:        topPx,
        left:       "50%",
        transform:  "translateX(-50%)",
        width:      "calc(100% - 48px)",
        maxWidth:   1100,
        zIndex:     1000,
        transition: easing,
        borderRadius: 21,
        padding:      1,
        background:   "linear-gradient(135deg, rgba(108,92,231,0.4), rgba(0,212,255,0.35), rgba(255,180,255,0.25), rgba(108,92,231,0.4))",
        backgroundSize: "300% 300%",
        animation:    "navBorderGlow 10s ease infinite",
      }}
    >
      {/* Inner frosted-glass pill */}
      <header
        style={{
          borderRadius:        20,
          height:              60,
          background:          "rgba(255, 255, 255, 0.88)",
          backdropFilter:      "blur(16px)",
          WebkitBackdropFilter:"blur(16px)",
          boxShadow:           "0 8px 32px rgba(108,92,231,0.12), 0 2px 8px rgba(0,0,0,0.08)",
          display:             "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems:          "center",
          padding:             "0 20px",
        }}
      >
        {/* ── Logo ── */}
        <Link
          href="/"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}
        >
          <LogoIcon size={32} />
          <span style={{
            fontSize:   17,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #1a1a2e 0%, #6c5ce7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor:  "transparent",
            backgroundClip:       "text",
          }}>
            StatementFlow
          </span>
        </Link>

        {/* ── Nav links with sliding pill ── */}
        <nav
          ref={navRef}
          className="hidden md:flex"
          style={{ position: "relative", alignItems: "center", gap: 2 }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* The sliding background pill */}
          <div
            aria-hidden="true"
            style={{
              position:   "absolute",
              top:        "50%",
              transform:  "translateY(-50%)",
              height:     34,
              left:       pill.left,
              width:      pill.width,
              background: "rgba(108, 92, 231, 0.12)",
              borderRadius: 10,
              opacity:    pill.opacity,
              transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
              pointerEvents: "none",
            }}
          />

          {NAV_LINKS.map(({ label, href, section }, i) => {
            const isActive  = activeSection === section;
            const isHovered = hoveredIdx === i;
            const highlight = isActive || isHovered;
            return (
              <a
                key={section}
                href={href}
                ref={(el) => { linkRefs.current[i] = el; }}
                className="npill"
                style={{
                  color:      highlight ? "#6c5ce7" : "#4a4a6a",
                  fontWeight: isActive  ? 600       : 500,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* ── Try Free ── */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="ntry" onClick={onScrollToUpload}>
            Try Free
          </button>
        </div>
      </header>
    </div>
  );
}
