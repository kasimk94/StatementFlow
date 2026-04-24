"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UploadZone from "../components/UploadZone";
import Dashboard from "../components/Dashboard";
import Navbar from "../components/Navbar";
import FeedbackPopup from "../components/FeedbackPopup";
import ReviewsSection from "../components/ReviewsSection";

// ── Demo transactions ─────────────────────────────────────────────────────────
const DEMO_TRANSACTIONS = [
  { date: "25 Mar 2026", description: "Salary - Employer Ltd",  category: "Income & Salary",          amount:  2850.00 },
  { date: "10 Mar 2026", description: "Freelance Payment",      category: "Income & Salary",          amount:   450.00 },
  { date: "01 Mar 2026", description: "HMRC Tax Refund",        category: "Income & Salary",          amount:   120.00 },
  { date: "28 Mar 2026", description: "HSBC Mortgage",          category: "Household Bills",          amount:  -950.00 },
  { date: "27 Mar 2026", description: "British Gas",            category: "Household Bills",          amount:   -85.00 },
  { date: "26 Mar 2026", description: "Sky",                    category: "Household Bills",          amount:   -45.00 },
  { date: "25 Mar 2026", description: "Vodafone",               category: "Household Bills",          amount:   -35.00 },
  { date: "24 Mar 2026", description: "Tesco Express",          category: "Supermarkets & Food",      amount:   -67.43 },
  { date: "23 Mar 2026", description: "Waitrose",               category: "Supermarkets & Food",      amount:   -78.20 },
  { date: "22 Mar 2026", description: "Tesco Express",          category: "Supermarkets & Food",      amount:   -45.10 },
  { date: "21 Mar 2026", description: "Amazon",                 category: "Online & High Street",     amount:   -89.99 },
  { date: "20 Mar 2026", description: "ASOS",                   category: "Online & High Street",     amount:   -43.00 },
  { date: "19 Mar 2026", description: "JD Sports",              category: "Online & High Street",     amount:   -65.00 },
  { date: "18 Mar 2026", description: "Amazon",                 category: "Online & High Street",     amount:   -23.99 },
  { date: "17 Mar 2026", description: "Deliveroo",              category: "Eating & Drinking",        amount:   -28.50 },
  { date: "16 Mar 2026", description: "Costa Coffee",           category: "Eating & Drinking",        amount:    -5.85 },
  { date: "15 Mar 2026", description: "Greggs",                 category: "Eating & Drinking",        amount:    -4.20 },
  { date: "14 Mar 2026", description: "Deliveroo",              category: "Eating & Drinking",        amount:   -22.00 },
  { date: "13 Mar 2026", description: "Costa Coffee",           category: "Eating & Drinking",        amount:    -4.50 },
  { date: "12 Mar 2026", description: "TfL",                    category: "Travel & Transport",       amount:    -3.50 },
  { date: "11 Mar 2026", description: "TfL",                    category: "Travel & Transport",       amount:    -2.80 },
  { date: "10 Mar 2026", description: "Uber",                   category: "Travel & Transport",       amount:   -14.20 },
  { date: "09 Mar 2026", description: "TfL",                    category: "Travel & Transport",       amount:    -3.50 },
  { date: "08 Mar 2026", description: "Netflix",                category: "Subscriptions & Streaming",amount:   -10.99 },
  { date: "07 Mar 2026", description: "Spotify",                category: "Subscriptions & Streaming",amount:    -9.99 },
  { date: "06 Mar 2026", description: "Tesco Express",          category: "Supermarkets & Food",      amount:   -34.50 },
  { date: "05 Mar 2026", description: "Amazon",                 category: "Online & High Street",     amount:   -34.99 },
  { date: "04 Mar 2026", description: "Greggs",                 category: "Eating & Drinking",        amount:    -3.80 },
  { date: "03 Mar 2026", description: "TfL",                    category: "Travel & Transport",       amount:    -2.80 },
  { date: "02 Mar 2026", description: "Costa Coffee",           category: "Eating & Drinking",        amount:    -4.95 },
];

const DEMO_INSIGHTS = {
  summary: "You're spending 82% of your income with a healthy £612 surplus this month",
  topInsight: "Over £67/month goes to subscriptions — Netflix, Spotify and Amazon Prime alone cost £29.97",
  spendingScore: 74,
  spendingScoreLabel: "Good",
};

// ── Hidden admin link ─────────────────────────────────────────────────────────
function AdminLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).get("admin") === "true");
  }, []);
  if (!show) return null;
  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <a href="#reviews" style={{ fontSize: "0.72rem", color: "#4A5568", textDecoration: "underline", opacity: 0.6 }}>
        Admin: manage reviews
      </a>
    </div>
  );
}

// ── Gold logo icon ────────────────────────────────────────────────────────────
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
        <rect x="1"  y="11" width="3" height="6"  rx="1" fill="#080C14" fillOpacity="0.65"/>
        <rect x="6"  y="7"  width="3" height="10" rx="1" fill="#080C14" fillOpacity="0.8"/>
        <rect x="11" y="3"  width="3" height="14" rx="1" fill="#080C14"/>
        <path d="M2.5 10.5 C5.5 6 9 6.5 12.5 2.5" stroke="#080C14" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        <path d="M10.5 1.5 L13 2.5 L12 5" stroke="#080C14" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );
}

// ── Pricing feature row ───────────────────────────────────────────────────────
function PricingFeature({ text, included, pro, comingSoon }) {
  const checkColor = pro ? "#C9A84C" : included ? "#C9A84C" : "#1E2A3A";
  const textColor  = included ? (pro ? "#F5F0E8" : "#8A9BB5") : "#4A5568";
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem" }}>
      {included ? (
        <svg style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, color: checkColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, color: "#4A5568" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span style={{ color: textColor }}>
        {text}
        {comingSoon && (
          <span style={{ marginLeft: 6, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" }}>SOON</span>
        )}
      </span>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [transactions,     setTransactions]     = useState(null);
  const [parseResult,      setParseResult]      = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [apiDone,          setApiDone]          = useState(false);
  const [error,            setError]            = useState(null);
  const [showFeedback,     setShowFeedback]     = useState(false);
  const [checkoutLoading,  setCheckoutLoading]  = useState(null);
  const pendingDataRef = useRef(null);

  const { data: session } = useSession();
  const router = useRouter();

  const handleCheckout = useCallback(async (plan) => {
    if (!session) { window.location.href = "/signup"; return; }
    setCheckoutLoading(plan);
    try {
      const res  = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally { setCheckoutLoading(null); }
  }, [session]);

  const [openFaq,      setOpenFaq]      = useState(null);
  const [billing,      setBilling]      = useState("monthly");
  const [billingFade,  setBillingFade]  = useState(true);

  const PRO_MONTHLY = 4.99;
  const BIZ_MONTHLY = 19.99;
  const PRO_ANNUAL  = (49.99 / 12);
  const BIZ_ANNUAL  = (199.99 / 12);

  function handleBilling(val) {
    if (val === billing) return;
    setBillingFade(false);
    setTimeout(() => { setBilling(val); setBillingFade(true); }, 200);
  }

  const FAQS = [
    { q: "Which banks are supported?",
      a: "StatementFlow works with all major UK banks including Barclays, HSBC, Lloyds, NatWest, Santander, Monzo, and Starling. If your bank produces a standard PDF statement, it will very likely work — even if your bank isn't listed here." },
    { q: "Is my data secure?",
      a: "Completely. Your PDF is processed entirely in-memory on our server and is never written to disk or stored in a database. Once your transactions are extracted, your data is discarded immediately. We never see, store, or share your financial information." },
    { q: "How accurate is the categorisation?",
      a: "Very accurate for well-known merchants and retailers. Our engine recognises thousands of UK businesses across 12+ spending categories. For unusual or generic transaction references, we flag them as 'Unknown' so you can review them manually." },
    { q: "Can accountants or bookkeepers use this?",
      a: "Absolutely. The exported Excel workbook includes a clean transaction sheet, a monthly summary tab, and a spending dashboard — perfect for bookkeeping reviews and tax preparation. Many accountants use it to quickly understand a client's spending patterns." },
    { q: "Is it really free?",
      a: "Yes, completely free with no strings attached. No account, no credit card, no usage limits. We built StatementFlow because we needed it ourselves and wanted to share it." },
    { q: "What file types are supported?",
      a: "PDF only at the moment. We're working on support for OFX/QIF files and CSV bank exports in a future update. Make sure you download your statement as a PDF from your online banking portal." },
  ];

  useEffect(() => { window.history.scrollRestoration = "manual"; }, []);

  const [uploadVisible,       setUploadVisible]       = useState(false);
  const [hasReviews,          setHasReviews]          = useState(false);
  const [uploadBadgesVisible, setUploadBadgesVisible] = useState(false);
  const [faqVisible,          setFaqVisible]          = useState(false);

  const uploadRef       = useRef(null);
  const uploadBadgesRef = useRef(null);
  const faqRef          = useRef(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("sf_reviews") || "[]");
      setHasReviews(stored.length > 0);
    } catch {}
  }, []);

  // Scroll-reveal: add "visible" class when element enters viewport
  useEffect(() => {
    const els = document.querySelectorAll(".scroll-animate, .anim-scale");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
        else e.target.classList.remove("visible");
      }),
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = uploadBadgesRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setUploadBadgesVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = faqRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFaqVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function handleFile(file) {
    setLoading(true); setApiDone(false); setError(null); setTransactions(null);
    pendingDataRef.current = null;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res  = await fetch("/api/convert", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");
      pendingDataRef.current = data;
      setApiDone(true);
    } catch (err) {
      setError(err.message); setLoading(false); setApiDone(false);
    }
  }

  function handleAnimationDone() {
    const data = pendingDataRef.current;
    if (!data) return;
    pendingDataRef.current = null;
    setLoading(false); setApiDone(false);

    // Logged-in users with a saved statement → go straight to dashboard page
    if (session && data.statementId) {
      router.push(`/dashboard?statementId=${data.statementId}`);
      return;
    }

    // Not logged in (or save failed) → show dashboard inline on this page
    setTransactions(data.transactions);
    setParseResult({
      confidence:           data.confidence,
      bank:                 data.bank,
      debug:                data.debug ?? null,
      insights:             data.insights ?? null,
      overdraftLimit:       data.overdraftLimit ?? 500,
      internalTransferTotal:data.internalTransferTotal ?? 0,
      reversalsCount:       data.reversalsCount ?? 0,
      statementIncome:      data.totalIncome ?? null,
      statementExpenses:    data.totalExpenses ?? null,
      startBalance:         data.startBalance ?? null,
      endBalance:           data.endBalance ?? null,
      vatSummary:           data.vatSummary ?? null,
      period:               data.period ?? null,
      realIncome:           data.realIncome ?? null,
      realSpending:         data.realSpending ?? null,
      validation:           data.validation ?? null,
    });
    window.scrollTo(0, 0);
  }

  function handleReset() { setTransactions(null); setError(null); setShowFeedback(false); }

  useEffect(() => {
    if (!transactions) return;
    if (sessionStorage.getItem("sf_feedback_shown")) return;
    const t = setTimeout(() => setShowFeedback(true), 10000);
    return () => clearTimeout(t);
  }, [transactions]);

  function closeFeedback() { sessionStorage.setItem("sf_feedback_shown", "1"); setShowFeedback(false); }

  function scrollToUpload() {
    setUploadVisible(true);
    setTimeout(() => {
      const el = document.getElementById("get-started");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  // ── Dashboard view (post-upload) ────────────────────────────────────────────
  if (transactions) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#080C14" }}>
        <Navbar onScrollToUpload={scrollToUpload} onUploadAnother={handleReset} />
        <main className="dash-main-inner max-w-6xl mx-auto px-6 py-10" style={{ paddingTop: 80 }}>
          <Dashboard
            transactions={transactions}
            confidence={parseResult?.confidence}
            bank={parseResult?.bank}
            debug={parseResult?.debug}
            insights={parseResult?.insights}
            overdraftLimit={parseResult?.overdraftLimit ?? 500}
            internalTransferTotal={parseResult?.internalTransferTotal ?? 0}
            reversalsCount={parseResult?.reversalsCount ?? 0}
            statementIncome={parseResult?.statementIncome ?? null}
            statementExpenses={parseResult?.statementExpenses ?? null}
            startBalance={parseResult?.startBalance ?? null}
            endBalance={parseResult?.endBalance ?? null}
            vatSummary={parseResult?.vatSummary ?? null}
            period={parseResult?.period ?? null}
            realIncome={parseResult?.realIncome ?? null}
            realSpending={parseResult?.realSpending ?? null}
            validation={parseResult?.validation ?? null}
          />
        </main>
        {showFeedback && <FeedbackPopup onClose={closeFeedback} />}
      </div>
    );
  }

  // ── Landing page ────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#080C14", color: "#F5F0E8", overflowX: "hidden" }}>
      <Navbar onScrollToUpload={scrollToUpload} showReviewsLink={hasReviews} />

      {/* SEO hidden text */}
      <p className="visually-hidden">StatementFlow is a free UK bank statement converter that transforms PDF bank statements into Excel reports and spending dashboards. Supporting all major UK banks including Barclays, HSBC, Lloyds, NatWest, Santander, Monzo and Starling.</p>

      {/* ══════════════════════════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════════════════════════ */}
      <section id="hero" style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#080C14", position: "relative", overflow: "hidden",
        padding: "140px 24px 80px",
      }}>
        {/* Radial gold glow — centred behind headline text */}
        <div style={{
          position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)",
          width: 800, height: 600, borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.07) 45%, transparent 72%)",
          filter: "blur(50px)",
          pointerEvents: "none",
        }} />
        {/* Noise texture overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
          pointerEvents: "none", opacity: 0.4,
        }} />

        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div className="animate-fade-up" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)",
            color: "#C9A84C", fontSize: "0.78rem", fontWeight: 600,
            padding: "8px 20px", borderRadius: 999, marginBottom: 40,
            letterSpacing: "0.04em",
          }}>
            <span style={{ width: 6, height: 6, background: "#C9A84C", borderRadius: "50%", boxShadow: "0 0 6px #C9A84C" }} />
            Structured data — not another finance app
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up-delay hero-headline" style={{
            fontSize: "clamp(2.8rem, 5.5vw, 4.8rem)", fontWeight: 800,
            lineHeight: 1.05, color: "#F5F0E8",
            marginBottom: 28, letterSpacing: "-0.03em",
          }}>
            Every finance app wants<br />
            your bank login.<br />
            <span style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              textShadow: "none", filter: "drop-shadow(0 0 40px rgba(201,168,76,0.4))",
            }}>
              StatementFlow just needs a PDF.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-up-delay-2 hero-subheadline" style={{
            color: "#8A9BB5", fontSize: "1.2rem", lineHeight: 1.7,
            maxWidth: 560, margin: "0 auto 40px",
          }}>
            Finally understand your money — upload your statement, get instant clarity.
            No bank login. No data stored.
          </p>

          {/* CTA buttons */}
          <div className="hero-cta-group animate-fade-up-delay-3" style={{ marginBottom: 48, gap: "12px" }}>
            <button
              onClick={scrollToUpload}
              className="btn-gold-pulse"
              style={{
                background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
                color: "#080C14", fontWeight: 600, fontSize: "0.95rem",
                padding: "14px 32px", borderRadius: 50, border: "none", cursor: "pointer",
                letterSpacing: "-0.01em",
                boxShadow: "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(201,168,76,0.45), 0 0 0 4px rgba(201,168,76,0.15), 0 0 0 8px rgba(201,168,76,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
            >
              Convert My Statement →
            </button>
            <button
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              style={{
                color: "#C9A84C", fontWeight: 500, fontSize: "0.95rem",
                padding: "14px 32px", borderRadius: 50,
                border: "1px solid rgba(201,168,76,0.35)",
                background: "transparent", cursor: "pointer",
                letterSpacing: "-0.01em", transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; e.currentTarget.style.background = "rgba(201,168,76,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"; e.currentTarget.style.background = "transparent"; }}
            >
              See How It Works
            </button>
          </div>

          {/* Trust bar */}
          <div className="hero-trust-bar animate-fade-up-delay-3">
            {["No bank connections", "Files deleted instantly", "Your data is never sold", "UK banks supported"].map(text => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.82rem", color: "#8A9BB5" }}>
                <span style={{ color: "#C9A84C", fontWeight: 700, fontSize: "1rem", lineHeight: 1 }}>✓</span>
                {text}
              </div>
            ))}
          </div>

          {/* Dashboard mockup preview */}
          <div className="animate-fade-up-delay-3" style={{ marginTop: 60, position: "relative" }}>
            {/* Floating verified badge */}
            <div style={{
              position: "absolute", top: -14, right: "8%", zIndex: 10,
              background: "#0D1117", border: "1px solid rgba(201,168,76,0.4)",
              borderRadius: 999, padding: "7px 16px",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              fontSize: "0.78rem", fontWeight: 700, color: "#C9A84C",
            }}>
              <span style={{ width: 8, height: 8, background: "#00D4A0", borderRadius: "50%", boxShadow: "0 0 6px #00D4A0" }} />
              ✓ Parsed in 47 seconds
            </div>
            <div style={{ filter: "drop-shadow(0 0 80px rgba(201,168,76,0.2)) drop-shadow(0 40px 80px rgba(0,0,0,0.6))", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ background: "#0D1117", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 16, padding: 24, maxWidth: 900, margin: "0 auto" }}>
                {/* Mock dashboard header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#C9A84C", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>✓ ANALYSED · March 2026 · Barclays</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#F5F0E8" }}>Spending Dashboard</div>
                  </div>
                  <div style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", fontSize: "0.72rem", fontWeight: 700, padding: "6px 14px", borderRadius: 999 }}>82 transactions</div>
                </div>
                {/* Mock KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {[["Money In","£3,522","#00D4A0"],["Money Out","£3,608","#EF4444"]].map(([l,v,c]) => (
                    <div key={l} style={{ background: "#111820", border: "1px solid #1E2A3A", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: "0.68rem", color: "#8A9BB5", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 800, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {/* Mock category bars */}
                {[["Household Bills","£1,115",87],["Supermarkets","£225",30],["Online Shopping","£213",28],["Eating & Drinking","£74",10]].map(([label,amt,pct]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: "0.78rem", color: "#8A9BB5" }}>{label}</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#F5F0E8" }}>{amt}</span>
                    </div>
                    <div style={{ height: 5, background: "#1E2A3A", borderRadius: 999 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#C9A84C,#E8C97A)", borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          2. STATS BAR
      ══════════════════════════════════════════════════════════════ */}
      <section style={{ background: "#0D1117", borderTop: "1px solid rgba(201,168,76,0.12)", borderBottom: "1px solid rgba(201,168,76,0.12)", paddingTop: 60, paddingBottom: 60, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0 }}>
          {[
            ["40+",       "UK Banks Supported"],
            ["< 60s",     "Processing Time"],
            ["100%",      "Private & Secure"],
            ["Excel",     "Export Ready"],
          ].map(([stat, label], i) => (
            <div key={label} style={{
              textAlign: "center", padding: "8px 16px",
              borderRight: i < 3 ? "1px solid #1E2A3A" : "none",
            }}>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#C9A84C", lineHeight: 1, marginBottom: 6 }}>{stat}</div>
              <div style={{ fontSize: "0.78rem", color: "#8A9BB5" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          3. PROBLEM SECTION
      ══════════════════════════════════════════════════════════════ */}
      <section className="hp-section" style={{ background: "#080C14" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <p className="scroll-animate" style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 16 }}>Sound Familiar?</p>
          <h2 className="scroll-animate" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.25, color: "#F5F0E8", marginBottom: 16, transitionDelay: "0.05s", letterSpacing: "-0.02em" }}>
            Your money is a mystery.<br />It doesn&apos;t have to be.
          </h2>
          <p className="scroll-animate" style={{ color: "#8A9BB5", fontSize: "1rem", marginBottom: 48, transitionDelay: "0.1s" }}>
            The same three frustrations come up again and again. All three are solved the moment you upload.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
            {[
              { icon: "💸", heading: '"Where did my money go this month?"', body: "You check your balance and it's lower than expected. You scroll through transactions and still have no idea. StatementFlow turns that chaos into a clear spending breakdown.", color: "#EF4444" },
              { icon: "⏱️", heading: '"Copy-pasting statements takes forever."', body: "If you're an accountant or business owner, you know the pain of manually cleaning bank data for every client. Upload once, get structured data instantly.", color: "#C9A84C" },
              { icon: "🔐", heading: '"Open Banking feels risky."', body: "You shouldn't need to hand over your login credentials just to understand your own finances. StatementFlow never connects to your bank — ever.", color: "#00D4A0" },
            ].map(({ icon, heading, body, color }, i) => (
              <div key={i} className="scroll-animate" style={{
                display: "flex", gap: 20, alignItems: "flex-start",
                transitionDelay: `${i * 0.1}s`,
                background: "linear-gradient(135deg, #0D1117, #111820)",
                border: "1px solid #1E2A3A",
                borderLeft: "3px solid #C9A84C",
                borderRadius: 14, padding: "24px 28px",
                paddingLeft: 20,
                transition: "box-shadow 0.2s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 24px rgba(0,0,0,0.3), inset 0 0 0 0 transparent`}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
              >
                <span style={{ fontSize: "1.8rem", flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "1rem", color: "#F5F0E8", margin: "0 0 6px", fontStyle: "italic" }}>{heading}</p>
                  <p style={{ color: "#8A9BB5", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="scroll-animate" style={{ marginTop: 48, fontWeight: 700, fontSize: "1.1rem", color: "#C9A84C", transitionDelay: "0.3s" }}>
            There&apos;s a smarter way. →
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          4. HOW IT WORKS
      ══════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="hp-section" style={{ background: "#0D1117", scrollMarginTop: "80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>How It Works</p>
            <h2 style={{ fontWeight: 800, color: "#F5F0E8", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12, letterSpacing: "-0.02em" }}>Upload Once. Understand Everything.</h2>
            <p style={{ color: "#8A9BB5", fontSize: "1rem", maxWidth: 520, margin: "0 auto" }}>Three steps from PDF to complete financial clarity. No account. No bank login.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {[
              { num: "01", title: "Upload your PDF", desc: "Download your statement from your bank app and drop it here. We support all major UK banks including Barclays, HSBC, Lloyds, Monzo, Starling and more." },
              { num: "02", title: "We structure it instantly", desc: "Our engine reads every transaction, categorises your spending, detects patterns, and builds your complete financial picture — in under 60 seconds." },
              { num: "03", title: "You get clarity", desc: "A live spending dashboard, downloadable Excel report, and CSV — ready for budgeting, tracking, or sending straight to your accountant." },
            ].map(({ num, title, desc }, i) => (
              <div key={num} className="scroll-animate" style={{
                background: "#111820", border: "1px solid #1E2A3A",
                borderRadius: 20, padding: "36px 28px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                textAlign: "center", transitionDelay: `${i * 0.12}s`,
                position: "relative", overflow: "hidden",
                transition: "border-color 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E2A3A"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Big step number */}
                <div style={{
                  fontSize: "5rem", fontWeight: 900, color: "#C9A84C",
                  opacity: 0.1, lineHeight: 1, position: "absolute",
                  top: 12, right: 20, userSelect: "none", fontFamily: "var(--font-playfair)",
                }}>{num}</div>
                {/* Step number pill */}
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 48, height: 48, background: "rgba(201,168,76,0.12)",
                  border: "1px solid rgba(201,168,76,0.3)",
                  borderRadius: "50%", marginBottom: 20,
                  fontSize: "1rem", fontWeight: 800, color: "#C9A84C",
                }}>{num}</div>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#F5F0E8", margin: "0 0 10px" }}>{title}</h3>
                <p style={{ color: "#8A9BB5", fontSize: "0.88rem", lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          5. WHO IS IT FOR
      ══════════════════════════════════════════════════════════════ */}
      <section className="hp-section" style={{ background: "#080C14" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>Who It&apos;s For</p>
            <h2 style={{ fontWeight: 800, color: "#F5F0E8", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)" }}>Which one are you?</h2>
          </div>
          <div className="audience-cards-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "stretch" }}>
            {/* Individuals card */}
            <div className="scroll-animate" style={{
              background: "#0D1117", border: "1px solid rgba(201,168,76,0.25)",
              borderRadius: 24, padding: "40px 36px",
              display: "flex", flexDirection: "column", height: "100%",
              position: "relative", overflow: "hidden",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.boxShadow = "0 0 32px rgba(201,168,76,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#C9A84C,#E8C97A)" }} />
              <div style={{ width: 52, height: 52, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, flexShrink: 0, fontSize: "1.4rem" }}>👤</div>
              <h3 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#F5F0E8", margin: "0 0 4px" }}>Take control of your money</h3>
              <p style={{ color: "#C9A84C", fontWeight: 600, fontSize: "0.8rem", margin: 0 }}>For individuals &amp; families</p>
              <p style={{ color: "#8A9BB5", fontSize: "0.9rem", lineHeight: 1.7, marginTop: 16, marginBottom: 20 }}>
                Upload your bank statement and finally see exactly where your money goes. Build your own budget tracker using data you trust — not estimates, not guesses.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Spending breakdown by category","Monthly dashboard with insights","Budget tracker ready to use","Your data never stored or shared"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "#8A9BB5", fontSize: "0.875rem" }}>
                    <span style={{ color: "#C9A84C", fontWeight: 700, flexShrink: 0 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <div style={{ flex: 1 }} />
              <div style={{ paddingTop: 32 }}>
                <button onClick={scrollToUpload} style={{ width: "100%", textAlign: "center", background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)", color: "#080C14", fontWeight: 600, padding: "14px 24px", borderRadius: 50, border: "none", cursor: "pointer", fontSize: "0.95rem", letterSpacing: "-0.01em", boxShadow: "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)", transition: "all 0.2s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(201,168,76,0.45), 0 0 0 4px rgba(201,168,76,0.15), 0 0 0 8px rgba(201,168,76,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
                >Try Free →</button>
              </div>
            </div>

            {/* Business card */}
            <div className="scroll-animate" style={{
              background: "linear-gradient(135deg, #0D1117, #111820)",
              border: "1px solid #C9A84C",
              borderRadius: 24, padding: "40px 36px",
              display: "flex", flexDirection: "column", height: "100%",
              position: "relative", overflow: "hidden", transitionDelay: "0.1s",
              boxShadow: "0 0 40px rgba(201,168,76,0.06)",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#C9A84C,#E8C97A)" }} />
              <div style={{ position: "absolute", top: -1, right: 24, background: "#C9A84C", color: "#080C14", fontSize: "0.65rem", fontWeight: 800, padding: "5px 14px", borderRadius: "0 0 8px 8px", letterSpacing: "0.06em" }}>POPULAR FOR PROS</div>
              <div style={{ width: 52, height: 52, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, flexShrink: 0, fontSize: "1.4rem" }}>📊</div>
              <h3 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#F5F0E8", margin: "0 0 4px" }}>Turn statements into structured data</h3>
              <p style={{ color: "#C9A84C", fontWeight: 600, fontSize: "0.8rem", margin: 0 }}>For accountants, bookkeepers &amp; businesses</p>
              <p style={{ color: "#8A9BB5", fontSize: "0.9rem", lineHeight: 1.7, marginTop: 16, marginBottom: 20 }}>
                Convert any client bank statement into clean, structured data instantly. Ready for reconciliation, VAT prep, and reporting — without a single minute of copy-pasting.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Debit & credit split columns","Tax category mapping","VAT estimation built in","Audit-ready reconciliation view"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "#8A9BB5", fontSize: "0.875rem" }}>
                    <span style={{ color: "#C9A84C", fontWeight: 700, flexShrink: 0 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <div style={{ flex: 1 }} />
              <div style={{ paddingTop: 32 }}>
                <button onClick={scrollToUpload} style={{ width: "100%", textAlign: "center", background: "transparent", color: "#C9A84C", fontWeight: 500, padding: "14px 24px", borderRadius: 50, border: "1px solid rgba(201,168,76,0.35)", cursor: "pointer", fontSize: "0.95rem", letterSpacing: "-0.01em", transition: "all 0.2s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; e.currentTarget.style.background = "rgba(201,168,76,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"; e.currentTarget.style.background = "transparent"; }}
                >See Business Features →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          6. BEFORE / AFTER TRANSFORMATION
      ══════════════════════════════════════════════════════════════ */}
      <section className="hp-section" style={{ background: "#0D1117" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>The Transformation</p>
            <h2 style={{ fontWeight: 800, color: "#F5F0E8", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>From messy PDF to complete clarity</h2>
            <p style={{ color: "#8A9BB5", fontSize: "1rem" }}>This is what happens the moment you upload.</p>
          </div>
          <div className="before-after-grid">
            {/* Before */}
            <div className="scroll-animate" style={{
              border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16,
              overflow: "hidden", minHeight: 380, display: "flex", flexDirection: "column",
              background: "rgba(239,68,68,0.04)",
            }}>
              <div style={{ background: "rgba(239,68,68,0.1)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
                <span style={{ background: "rgba(239,68,68,0.2)", color: "#EF4444", fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>YOUR PDF STATEMENT</span>
              </div>
              <div style={{ padding: "20px", flex: 1 }}>
                {[
                  ["03 Mar","FPS OUT JOHN SMITH REF SN2024...","450.00"],
                  ["04 Mar","CARD PAYMENT TO AMZNMKTPLACE*YH7G...","23.99"],
                  ["04 Mar","DD BARCLAYS PRTNR FIN SRV...","237.38"],
                  ["05 Mar","FASTER PAYMENTS REC'D 004523...","1200.00"],
                  ["06 Mar","CARD PAYMENT TO PAYPAL *PENNYAP...","10.00"],
                ].map(([d,t,a],i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "72px 1fr 64px",
                    gap: 8, padding: "8px 0", borderBottom: "1px solid #1E2A3A",
                    fontSize: "0.82rem", color: "#4A5568",
                    filter: i > 2 ? `blur(${(i-2)*2}px)` : "none",
                    opacity: i > 3 ? 0.2 : 1,
                  }}>
                    <span style={{ whiteSpace: "nowrap", color: "#8A9BB5" }}>{d}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
                    <span style={{ textAlign: "right", color: "#EF4444" }}>{a}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: "0.72rem", color: "#4A5568", fontStyle: "italic" }}>...47 more rows</div>
              </div>
              <p style={{ textAlign: "center", padding: "14px", color: "#4A5568", fontSize: "0.75rem", fontStyle: "italic", borderTop: "1px solid #1E2A3A" }}>A PDF only a bank could love</p>
            </div>

            {/* Arrow */}
            <div className="before-after-arrow-h" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1,
                background: "linear-gradient(135deg,#C9A84C,#E8C97A)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>→</div>
              <div style={{ fontSize: "0.6rem", color: "#C9A84C", fontWeight: 700, letterSpacing: "0.06em", marginTop: 6, textTransform: "uppercase" }}>StatementFlow</div>
            </div>
            <div className="before-after-arrow-v" style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: "2rem", color: "#C9A84C", fontWeight: 900 }}>↓</div>
              <div style={{ fontSize: "0.6rem", color: "#C9A84C", fontWeight: 700, letterSpacing: "0.06em", marginTop: 6 }}>StatementFlow</div>
            </div>

            {/* After */}
            <div className="scroll-animate" style={{
              border: "1px solid rgba(201,168,76,0.35)", borderRadius: 16,
              minHeight: 380, display: "flex", flexDirection: "column",
              background: "rgba(201,168,76,0.03)",
              boxShadow: "0 0 40px rgba(201,168,76,0.06)", transitionDelay: "0.1s",
              padding: 24,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ background: "rgba(0,212,160,0.15)", color: "#00D4A0", fontSize: "0.7rem", fontWeight: 700, padding: "4px 12px", borderRadius: 999, display: "inline-block", marginBottom: 6 }}>✓ ANALYSED</div>
                  <div style={{ fontSize: "0.75rem", color: "#8A9BB5" }}>March 2024 · Barclays</div>
                </div>
                <div style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C", fontSize: "0.7rem", fontWeight: 700, padding: "6px 12px", borderRadius: 999 }}>82 transactions</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[["Money In","£3,522","#00D4A0"],["Money Out","£3,608","#EF4444"]].map(([l,v,c]) => (
                  <div key={l} style={{ background: "#111820", border: "1px solid #1E2A3A", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: "0.65rem", color: "#8A9BB5", marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#C9A84C", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Spending Breakdown</div>
              {[
                ["🏦","Bills","£1,115",87],
                ["🛒","Groceries","£225",28],
                ["🛍️","Shopping","£213",26],
                ["🍽️","Eating Out","£74",9],
              ].map(([icon,label,amt,pct]) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", color: "#8A9BB5" }}>{icon} {label}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#F5F0E8" }}>{amt}</span>
                  </div>
                  <div style={{ height: 5, background: "#1E2A3A", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#C9A84C,#E8C97A)", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
              <div style={{ textAlign: "center", marginTop: "auto", paddingTop: 16, fontSize: "0.72rem", color: "#C9A84C", fontWeight: 600 }}>✓ Categorised instantly · Your bank never shows this</div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button onClick={scrollToUpload} className="btn-gold-pulse" style={{
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
              color: "#080C14", fontWeight: 600, fontSize: "0.95rem",
              padding: "14px 36px", borderRadius: 50, border: "none", cursor: "pointer",
              letterSpacing: "-0.01em",
              boxShadow: "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
              transition: "all 0.2s ease",
            }}>
              Convert My Statement Free →
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          7. FEATURES GRID
      ══════════════════════════════════════════════════════════════ */}
      <section id="features" className="hp-section" style={{ background: "#080C14", scrollMarginTop: "80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Features</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F5F0E8" }}>
              Everything you need to understand your finances
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {[
              { icon: "📊", title: "Spending Dashboard",  desc: "Visual charts, category breakdown, and one-click filtering — see every penny, grouped and searchable.",      },
              { icon: "📥", title: "Excel Export",        desc: "Beautifully formatted 3-sheet workbook with charts, totals, and a monthly summary — ready for your accountant." },
              { icon: "🏷️", title: "Auto Categories",    desc: "12+ spending categories applied automatically — groceries, transport, bills, subscriptions, and more."         },
              { icon: "🔒", title: "Zero Storage",        desc: "Your data never touches our servers long-term. Processed in-memory and discarded the moment you're done."      },
              { icon: "🏦", title: "Any UK Bank",         desc: "Works with Barclays, HSBC, Lloyds, NatWest, Monzo, Starling, Santander, Halifax and more."                   },
              { icon: "⚡", title: "Instant Results",     desc: "Processing takes under 60 seconds. No waiting, no queues, no sign-up required to get started."                },
            ].map(({ icon, title, desc }, idx) => (
              <div
                key={title}
                className="anim-scale"
                style={{
                  transitionDelay: `${idx * 0.1}s`,
                  background: "linear-gradient(135deg, #0D1117 0%, #111820 100%)", border: "1px solid #1E2A3A",
                  borderRadius: 16, padding: 28,
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
                  cursor: "default",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(201,168,76,0.08)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E2A3A"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ width: 48, height: 48, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", marginBottom: 18 }}>
                  {icon}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#F5F0E8", marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#8A9BB5", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <ReviewsSection onScrollToUpload={scrollToUpload} />

      {/* ══════════════════════════════════════════════════════════════
          8. SECURITY
      ══════════════════════════════════════════════════════════════ */}
      <section id="security" className="hp-section" style={{ background: "#0D1117", scrollMarginTop: "80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>Security &amp; Privacy</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F5F0E8" }}>Zero-Knowledge Architecture</h2>
            <p style={{ fontSize: "1rem", color: "#8A9BB5", marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>
              Your financial data never persists. We process everything in-memory and delete it instantly.
            </p>
          </div>

          {/* Gold shield badge */}
          <div className="scroll-animate" style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            <div style={{
              display: "inline-flex", flexDirection: "column", alignItems: "center",
              border: "2px solid rgba(201,168,76,0.4)", borderRadius: 20,
              padding: "28px 40px", background: "rgba(201,168,76,0.04)",
              boxShadow: "0 0 40px rgba(201,168,76,0.08)",
            }}>
              <div style={{ width: 60, height: 60, background: "rgba(201,168,76,0.12)", border: "2px solid rgba(201,168,76,0.4)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, fontSize: "1.8rem" }}>🛡️</div>
              <p style={{ fontWeight: 800, fontSize: "1rem", color: "#C9A84C", margin: "0 0 4px 0", textAlign: "center" }}>Zero-Knowledge Architecture</p>
              <p style={{ fontSize: "0.75rem", color: "#8A9BB5", margin: "0 0 14px 0", textAlign: "center" }}>Verified Privacy Standard</p>
              <div style={{ width: "100%", height: 1, background: "#1E2A3A", margin: "0 0 12px 0" }} />
              <p style={{ fontSize: "0.7rem", color: "#4A5568", margin: 0, textAlign: "center", letterSpacing: "0.06em" }}>STATEMENTFLOW · UK</p>
            </div>
          </div>

          {/* Security feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 security-grid-2col">
            {[
              { icon: "🧠", title: "Local-First Processing",      desc: "Your PDF is processed entirely in your browser session. No data is sent to external servers for storage — ever." },
              { icon: "🔑", title: "Zero-Knowledge Architecture", desc: "We never see your transactions. Our system processes data in isolated memory that is wiped the moment your session ends." },
              { icon: "🇬🇧", title: "UK Privacy Compliant",       desc: "Built to exceed UK GDPR standards. No cookies tracking your financial behaviour, no third-party data sharing." },
              { icon: "✓",  title: "No Account Required",        desc: "We don't collect your name, email, or any personal information. Upload, analyse, download, done." },
            ].map(({ icon, title, desc }, idx) => (
              <div key={title} className="anim-scale" style={{
                transitionDelay: `${idx * 0.1}s`,
                background: "#080C14", border: "1px solid #1E2A3A",
                borderLeft: "3px solid rgba(201,168,76,0.4)",
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ width: 48, height: 48, background: "rgba(201,168,76,0.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", marginBottom: 16 }}>
                  {icon}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#F5F0E8", marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#8A9BB5", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          9. COMPARISON TABLE
      ══════════════════════════════════════════════════════════════ */}
      <section className="hp-section" style={{ background: "#080C14" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#C9A84C", textTransform: "uppercase", marginBottom: 12 }}>Why StatementFlow</p>
            <h2 style={{ fontWeight: 800, color: "#F5F0E8", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>The smarter way to handle your statement</h2>
            <p style={{ color: "#8A9BB5", fontSize: "1rem" }}>See how we compare to the alternatives.</p>
          </div>
          <p className="comparison-table-hint" style={{ textAlign: "center", fontSize: "0.75rem", color: "#4A5568", marginBottom: 10 }}>← Scroll to see more →</p>
          <div className="scroll-animate comparison-table-wrap" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #1E2A3A" }}>
            <table className="comparison-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ background: "#0D1117", padding: "14px 20px", textAlign: "left", fontSize: "0.8rem", fontWeight: 700, color: "#8A9BB5", borderBottom: "1px solid #1E2A3A" }}>Feature</th>
                  <th style={{ background: "rgba(201,168,76,0.12)", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "#C9A84C", borderBottom: "1px solid rgba(201,168,76,0.2)" }}>StatementFlow</th>
                  <th style={{ background: "#0D1117", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "#8A9BB5", borderBottom: "1px solid #1E2A3A" }}>Manual Copy-Paste</th>
                  <th style={{ background: "#0D1117", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "#8A9BB5", borderBottom: "1px solid #1E2A3A" }}>Open Banking Apps</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Instant results",         "✓", "✗", "~"],
                  ["No bank login required",  "✓", "✓", "✗"],
                  ["Spending categorisation", "✓", "✗", "✓"],
                  ["Excel & CSV export",      "✓", "~", "✗"],
                  ["Accountant-ready data",   "✓", "✗", "✗"],
                  ["Zero data stored",        "✓", "✓", "✗"],
                  ["Works with all UK banks", "✓", "✓", "~"],
                  ["VAT estimation",          "✓", "✗", "✗"],
                  ["Free to use",             "✓", "✓", "✗"],
                ].map(([feature, sf, mc, ob], i, arr) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#080C14" : "#0D1117" }}>
                    <td style={{ padding: "13px 20px", fontSize: "0.875rem", fontWeight: 500, color: "#8A9BB5", borderBottom: i < arr.length - 1 ? "1px solid #1E2A3A" : "none" }}>{feature}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "0.9rem", fontWeight: 700, color: sf === "✓" ? "#C9A84C" : "#4A5568", background: "rgba(201,168,76,0.04)", borderBottom: i < arr.length - 1 ? "1px solid rgba(201,168,76,0.1)" : "none" }}>{sf}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "0.9rem", color: mc === "✓" ? "#00D4A0" : "#4A5568", borderBottom: i < arr.length - 1 ? "1px solid #1E2A3A" : "none" }}>{mc}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "0.9rem", color: ob === "✓" ? "#00D4A0" : "#4A5568", borderBottom: i < arr.length - 1 ? "1px solid #1E2A3A" : "none" }}>{ob}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: "center", padding: "10px 0", fontSize: "0.72rem", color: "#4A5568", background: "#0D1117" }}>~ = partial support</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          10. PRICING
      ══════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="hp-section" style={{ background: "#0D1117", scrollMarginTop: "80px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Pricing</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F5F0E8", marginBottom: 12 }}>Simple, Transparent Pricing</h2>
            <p style={{ fontSize: "1rem", color: "#8A9BB5" }}>Start free, upgrade when you need more</p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            <div style={{ display: "flex", background: "#080C14", border: "1px solid #1E2A3A", borderRadius: 999, padding: 4, gap: 0 }}>
              {[["monthly","Monthly"],["annually","Annually · Save 34%"]].map(([val, label]) => (
                <button key={val} onClick={() => handleBilling(val)} style={{
                  padding: "9px 22px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: "0.875rem", fontWeight: 600, transition: "all 0.2s ease",
                  background: billing === val ? "#C9A84C" : "transparent",
                  color: billing === val ? "#080C14" : "#8A9BB5",
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="pricing-grid-mobile grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

            {/* FREE */}
            <div className="scroll-animate flex flex-col" style={{ background: "#080C14", border: "1px solid #1E2A3A", borderRadius: 20, padding: 32, transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4A5568", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Free</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, color: "#F5F0E8", lineHeight: 1 }}>£0</span>
                  <span style={{ color: "#8A9BB5", paddingBottom: 8 }}>/month</span>
                </div>
                <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginTop: 8 }}>Perfect for getting started</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <PricingFeature text="1 PDF upload per month" included />
                <PricingFeature text="Up to 100 transactions" included />
                <PricingFeature text="Spending dashboard" included />
                <PricingFeature text="AI categorisation" included />
                <PricingFeature text="Excel export" />
                <PricingFeature text="CSV export" />
                <PricingFeature text="Monthly spending report" />
              </ul>
              <button onClick={scrollToUpload} style={{ width: "100%", padding: "13px 0", borderRadius: 50, fontSize: "0.875rem", fontWeight: 500, color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)", background: "transparent", cursor: "pointer", letterSpacing: "-0.01em", transition: "all 0.2s ease" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; e.currentTarget.style.background = "rgba(201,168,76,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"; e.currentTarget.style.background = "transparent"; }}
              >Get Started Free</button>
            </div>

            {/* PRO */}
            <div className="pricing-card-pro-mobile scroll-animate relative md:-mt-5 md:-mb-5 flex flex-col z-10"
              style={{
                background: "linear-gradient(135deg, #0D1117, #111820)",
                border: "2px solid #C9A84C",
                boxShadow: "0 0 40px rgba(201,168,76,0.12), 0 20px 60px rgba(0,0,0,0.3)",
                borderRadius: 20, padding: 32, transitionDelay: "0.1s",
                display: "flex", flexDirection: "column",
                transition: "box-shadow 0.2s ease, transform 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 60px rgba(201,168,76,0.2), 0 28px 72px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 40px rgba(201,168,76,0.12), 0 20px 60px rgba(0,0,0,0.3)"; e.currentTarget.style.transform = ""; }}
            >
              {/* Most Popular badge */}
              <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span style={{ background: "#C9A84C", color: "#080C14", fontSize: "0.72rem", fontWeight: 800, padding: "5px 16px", borderRadius: 999, boxShadow: "0 4px 12px rgba(201,168,76,0.4)" }}>✦ Most Popular</span>
              </div>
              <div style={{ marginBottom: 24, marginTop: 16 }}>
                <h3 style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(201,168,76,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Pro</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, color: "#C9A84C", lineHeight: 1, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s" }}>
                    £{billing === "monthly" ? PRO_MONTHLY.toFixed(2) : PRO_ANNUAL.toFixed(2)}
                  </span>
                  <span style={{ color: "#8A9BB5", paddingBottom: 8, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s" }}>/month</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginTop: 2, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s" }}>
                  {billing === "annually" ? <><span style={{ color: "#00D4A0", fontWeight: 700 }}>Save £10</span> · billed £49.99 annually</> : <>&nbsp;</>}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginTop: 8 }}>For individuals who want full control</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <PricingFeature text="Unlimited uploads" included pro />
                <PricingFeature text="Unlimited transactions" included pro />
                <PricingFeature text="Full spending dashboard" included pro />
                <PricingFeature text="Unlimited AI categorisation" included pro />
                <PricingFeature text="Full AI insights" included pro />
                <PricingFeature text="Excel & CSV export" included pro />
                <PricingFeature text="Monthly spending report" included pro />
                <PricingFeature text="3 months statement history" included pro />
              </ul>
              <button onClick={() => handleCheckout("PRO")} disabled={checkoutLoading === "PRO"} style={{ width: "100%", padding: "14px 0", borderRadius: 50, fontSize: "0.875rem", fontWeight: 600, color: "#080C14", background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)", border: "none", cursor: "pointer", letterSpacing: "-0.01em", boxShadow: "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)", transition: "all 0.2s ease", opacity: checkoutLoading === "PRO" ? 0.6 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(201,168,76,0.45), 0 0 0 4px rgba(201,168,76,0.15), 0 0 0 8px rgba(201,168,76,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
              >{checkoutLoading === "PRO" ? "Redirecting…" : "Start Pro"}</button>
            </div>

            {/* BUSINESS */}
            <div className="scroll-animate flex flex-col" style={{ background: "#080C14", border: "1px solid #1E2A3A", borderRadius: 20, padding: 32, transitionDelay: "0.2s", transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4A5568", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Business</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, color: "#F5F0E8", lineHeight: 1, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s" }}>
                    £{billing === "monthly" ? BIZ_MONTHLY.toFixed(2) : BIZ_ANNUAL.toFixed(2)}
                  </span>
                  <span style={{ color: "#8A9BB5", paddingBottom: 8, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s" }}>/month</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginTop: 2, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s" }}>
                  {billing === "annually" ? <><span style={{ color: "#00D4A0", fontWeight: 700 }}>Save £40</span> · billed £199.99 annually</> : <>&nbsp;</>}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginTop: 8 }}>For accountants &amp; small businesses</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <PricingFeature text="Everything in Pro" included />
                <PricingFeature text="12 months statement history" included />
                <PricingFeature text="Multiple bank accounts" included comingSoon />
                <PricingFeature text="AI chat assistant" included comingSoon />
                <PricingFeature text="Business expense tagging" included comingSoon />
                <PricingFeature text="Priority support" included />
              </ul>
              <button onClick={() => handleCheckout("BUSINESS")} disabled={checkoutLoading === "BUSINESS"} style={{ width: "100%", padding: "13px 0", borderRadius: 50, fontSize: "0.875rem", fontWeight: 500, color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)", background: "transparent", cursor: "pointer", letterSpacing: "-0.01em", transition: "all 0.2s ease", opacity: checkoutLoading === "BUSINESS" ? 0.6 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; e.currentTarget.style.background = "rgba(201,168,76,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.35)"; e.currentTarget.style.background = "transparent"; }}
              >{checkoutLoading === "BUSINESS" ? "Redirecting…" : "Start Business"}</button>
            </div>
          </div>

          <div className="text-center" style={{ marginTop: 32 }}>
            <a href="#faq" onClick={e => { e.preventDefault(); document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); }}
              style={{ fontSize: "0.875rem", color: "#8A9BB5", textDecoration: "none", transition: "color 0.2s ease" }}
              onMouseEnter={e => e.currentTarget.style.color = "#C9A84C"}
              onMouseLeave={e => e.currentTarget.style.color = "#8A9BB5"}
            >Have questions? See our FAQ ↓</a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          11. COMPETITOR COMPARISON
      ══════════════════════════════════════════════════════════════ */}
      <section className="hp-section" style={{ background: "#080C14" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
              Why StatementFlow
            </p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F5F0E8", margin: "0 0 14px", letterSpacing: "-0.02em" }}>
              The smarter way to understand your money
            </h2>
            <p style={{ color: "#8A9BB5", fontSize: "1.1rem", margin: 0, lineHeight: 1.6, maxWidth: 560, marginInline: "auto" }}>
              We're the only UK tool that works without giving anyone access to your bank account
            </p>
          </div>

          {/* Comparison table card */}
          <div style={{
            background: "#0D1117",
            border: "1px solid rgba(201,168,76,0.15)",
            borderRadius: 20,
            overflow: "hidden",
            maxWidth: 900,
            margin: "0 auto",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>

                {/* Column headers */}
                <thead>
                  <tr style={{ background: "#080C14" }}>
                    {/* Feature column */}
                    <th style={{
                      width: "30%", padding: "18px 20px",
                      textAlign: "left", color: "#8A9BB5",
                      fontSize: "0.78rem", fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      borderBottom: "1px solid rgba(201,168,76,0.1)",
                    }}>
                      Feature
                    </th>

                    {/* StatementFlow — highlighted */}
                    <th style={{
                      padding: "18px 16px",
                      background: "rgba(201,168,76,0.06)",
                      borderLeft: "1px solid rgba(201,168,76,0.2)",
                      borderRight: "1px solid rgba(201,168,76,0.2)",
                      borderBottom: "1px solid rgba(201,168,76,0.1)",
                      textAlign: "center",
                    }}>
                      <div style={{
                        background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontSize: "0.95rem", fontWeight: 800,
                        letterSpacing: "-0.01em",
                      }}>
                        StatementFlow
                      </div>
                      <span style={{
                        display: "inline-block", marginTop: 6,
                        background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
                        color: "#080C14", fontSize: "0.62rem", fontWeight: 800,
                        padding: "2px 9px", borderRadius: 999,
                        letterSpacing: "0.04em",
                      }}>
                        ⭐ Best
                      </span>
                    </th>

                    {/* Emma */}
                    <th style={{
                      padding: "18px 16px", textAlign: "center",
                      color: "#8A9BB5", fontSize: "0.9rem", fontWeight: 500,
                      borderBottom: "1px solid rgba(201,168,76,0.1)",
                    }}>
                      Emma
                    </th>

                    {/* Snoop */}
                    <th style={{
                      padding: "18px 16px", textAlign: "center",
                      color: "#8A9BB5", fontSize: "0.9rem", fontWeight: 500,
                      borderBottom: "1px solid rgba(201,168,76,0.1)",
                    }}>
                      Snoop
                    </th>

                    {/* DocuClipper */}
                    <th style={{
                      padding: "18px 16px", textAlign: "center",
                      color: "#8A9BB5", fontSize: "0.9rem", fontWeight: 500,
                      borderBottom: "1px solid rgba(201,168,76,0.1)",
                    }}>
                      DocuClipper
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[
                    { feature: "No bank login needed",      sf: true,   emma: false,  snoop: false, docu: true,     isPrice: false },
                    { feature: "No signup required to try", sf: true,   emma: false,  snoop: false, docu: false,    isPrice: false },
                    { feature: "PDF statement upload",      sf: true,   emma: false,  snoop: false, docu: true,     isPrice: false },
                    { feature: "Instant spending dashboard",sf: true,   emma: true,   snoop: true,  docu: false,    isPrice: false },
                    { feature: "Excel & CSV export",        sf: true,   emma: false,  snoop: false, docu: true,     isPrice: false },
                    { feature: "VAT & audit-ready view",    sf: true,   emma: false,  snoop: false, docu: false,    isPrice: false },
                    { feature: "Budget tracking",           sf: true,   emma: true,   snoop: true,  docu: false,    isPrice: false },
                    { feature: "Statement history",         sf: true,   emma: true,   snoop: true,  docu: false,    isPrice: false },
                    { feature: "UK banks supported",        sf: true,   emma: true,   snoop: true,  docu: "partial",isPrice: false },
                    { feature: "Price from",                sf: "Free", emma: "£4.99/mo", snoop: "Free", docu: "$39/mo", isPrice: true },
                  ].map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg  = isEven ? "rgba(255,255,255,0.01)" : "transparent";

                    function Cell({ val, isSF, isPrice }) {
                      if (isPrice) {
                        return (
                          <span style={{
                            fontSize: "0.875rem", fontWeight: 700,
                            color: isSF ? "#C9A84C" : "#8A9BB5",
                          }}>
                            {val}
                          </span>
                        );
                      }
                      if (val === "partial") {
                        return (
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#F59E0B" }}>
                            Partial
                          </span>
                        );
                      }
                      if (val === true) {
                        return (
                          <svg
                            width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="#10B981" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={isSF ? { filter: "drop-shadow(0 0 4px rgba(201,168,76,0.3))" } : {}}
                          >
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        );
                      }
                      return (
                        <svg
                          width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="#EF4444" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{ opacity: 0.6 }}
                        >
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      );
                    }

                    return (
                      <tr
                        key={row.feature}
                        style={{ background: rowBg, transition: "background 120ms ease" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,168,76,0.03)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}
                      >
                        {/* Feature label */}
                        <td style={{
                          padding: "15px 20px",
                          color: "#F5F0E8", fontSize: "0.9rem", fontWeight: 500,
                          borderBottom: idx < 9 ? "1px solid rgba(30,42,58,0.5)" : "none",
                        }}>
                          {row.feature}
                        </td>

                        {/* StatementFlow */}
                        <td style={{
                          padding: "15px 16px", textAlign: "center",
                          background: "rgba(201,168,76,0.06)",
                          borderLeft: "1px solid rgba(201,168,76,0.2)",
                          borderRight: "1px solid rgba(201,168,76,0.2)",
                          borderBottom: idx < 9 ? "1px solid rgba(201,168,76,0.08)" : "none",
                        }}>
                          <Cell val={row.sf} isSF isPrice={row.isPrice} />
                        </td>

                        {/* Emma */}
                        <td style={{
                          padding: "15px 16px", textAlign: "center",
                          borderBottom: idx < 9 ? "1px solid rgba(30,42,58,0.5)" : "none",
                        }}>
                          <Cell val={row.emma} isPrice={row.isPrice} />
                        </td>

                        {/* Snoop */}
                        <td style={{
                          padding: "15px 16px", textAlign: "center",
                          borderBottom: idx < 9 ? "1px solid rgba(30,42,58,0.5)" : "none",
                        }}>
                          <Cell val={row.snoop} isPrice={row.isPrice} />
                        </td>

                        {/* DocuClipper */}
                        <td style={{
                          padding: "15px 16px", textAlign: "center",
                          borderBottom: idx < 9 ? "1px solid rgba(30,42,58,0.5)" : "none",
                        }}>
                          <Cell val={row.docu} isPrice={row.isPrice} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Disclaimer */}
            <div style={{
              padding: "14px 20px",
              borderTop: "1px solid rgba(30,42,58,0.6)",
              background: "rgba(0,0,0,0.15)",
            }}>
              <p style={{
                margin: 0, color: "#8A9BB5", fontSize: "0.75rem",
                fontStyle: "italic", lineHeight: 1.5,
              }}>
                Feature comparison based on publicly available information as of April 2026. Emma and Snoop use Open Banking which requires granting app access to your live bank account.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <a
              href="/upload"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
                color: "#080C14", fontWeight: 700, fontSize: "1rem",
                padding: "14px 34px", borderRadius: 50,
                textDecoration: "none",
                boxShadow: "0 4px 24px rgba(201,168,76,0.35)",
                transition: "box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 36px rgba(201,168,76,0.55)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(201,168,76,0.35)"; }}
            >
              Try StatementFlow Free →
            </a>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          12. FAQ
      ══════════════════════════════════════════════════════════════ */}
      <section id="faq" aria-label="Frequently Asked Questions" className="hp-section" style={{ background: "#080C14" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F5F0E8" }}>Frequently Asked Questions</h2>
          </div>

          <div ref={faqRef} style={{ borderRadius: 16, border: "1px solid #1E2A3A", overflow: "hidden" }}>
            {FAQS.map(({ q, a }, i) => (
              <div key={i} className="faq-item" style={{
                borderBottom: i < FAQS.length - 1 ? "1px solid #1E2A3A" : "none",
                opacity:    faqVisible ? 1 : 0,
                transform:  faqVisible ? "translateX(0)" : "translateX(-20px)",
                transition: `opacity 0.45s ease-out ${i * 0.08}s, transform 0.45s ease-out ${i * 0.08}s`,
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 24px", textAlign: "left", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s ease" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0D1117"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#F5F0E8" }}>{q}</span>
                  <span style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                    border: "1px solid rgba(201,168,76,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#C9A84C", fontSize: "1.2rem", fontWeight: 300,
                    transition: "transform 0.2s ease, background 0.2s ease",
                    transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)",
                    background: openFaq === i ? "rgba(201,168,76,0.12)" : "transparent",
                  }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 24px 20px 24px", paddingTop: 0, fontSize: "0.875rem", color: "#8A9BB5", lineHeight: 1.75, borderTop: "1px solid #1E2A3A" }}>{a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          UPLOAD SECTION (hidden until CTA clicked)
      ══════════════════════════════════════════════════════════════ */}
      <section ref={uploadRef} id="get-started" className="px-6" style={{
        overflow: "hidden",
        maxHeight: uploadVisible ? "900px" : "0",
        transition: uploadVisible ? "max-height 0.6s ease" : "none",
        background: "#0D1117",
        borderTop: uploadVisible ? "1px solid rgba(201,168,76,0.15)" : "none",
      }}>
        <div className="max-w-2xl mx-auto text-center" style={{
          padding: "96px 0",
          opacity:   uploadVisible ? 1 : 0,
          transform: uploadVisible ? "translateY(0)" : "translateY(24px)",
          transition: "opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s",
        }}>
          <p style={{ color: "#C9A84C", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Get Started</p>
          <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F5F0E8", marginBottom: 16 }}>Ready to get started?</h2>
          <p style={{ color: "#8A9BB5", marginBottom: 40 }}>Drop your PDF below. No sign-up, no credit card, no data stored — ever.</p>

          <div className="flex justify-center">
            <UploadZone onFile={handleFile} loading={loading} apiDone={apiDone} onAnimationDone={handleAnimationDone} error={error} />
          </div>

          {error && !/scanned|image.based|could not read this pdf/i.test(error) && (
            <div className="mt-6 flex items-start gap-3 rounded-xl px-5 py-4 max-w-lg mx-auto text-left" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}>
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-sm">Could not parse statement</p>
                <p className="text-sm mt-0.5" style={{ color: "#EF4444", opacity: 0.8 }}>{error}</p>
              </div>
            </div>
          )}

          <div ref={uploadBadgesRef} className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs" style={{ color: "#8A9BB5" }}>
            {[
              { d: "M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", label: "Your file is never stored" },
              { d: "M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z", label: "Processed in-memory" },
              { d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", label: "No account required" },
            ].map(({ d, label }, i) => (
              <span key={label} className="flex items-center gap-1.5" style={{ opacity: uploadBadgesVisible ? 1 : 0, transform: uploadBadgesVisible ? "scale(1)" : "scale(0.85)", transition: `opacity 0.4s ease-out ${i * 0.12}s, transform 0.4s ease-out ${i * 0.12}s` }}>
                <svg className="w-4 h-4" style={{ color: "#C9A84C" }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d={d} clipRule="evenodd" />
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          12. FINAL CTA BANNER
      ══════════════════════════════════════════════════════════════ */}
      <section className="hp-section" style={{
        background: "linear-gradient(135deg, #0D1117 0%, #111820 50%, #0D1117 100%)",
        borderTop: "1px solid rgba(201,168,76,0.2)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Gold radial glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(201,168,76,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h2 className="scroll-animate final-cta-headline" style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 800, color: "#F5F0E8", lineHeight: 1.15, marginBottom: 20, letterSpacing: "-0.02em" }}>
            Your bank statement is trying<br />to tell you something.
          </h2>
          <p className="scroll-animate" style={{ color: "#8A9BB5", fontSize: "1.1rem", lineHeight: 1.75, marginBottom: 40, transitionDelay: "0.05s", maxWidth: 520, margin: "0 auto 40px" }}>
            Every month you pay for things you&apos;ve forgotten. Every month you wonder where it all went.
            StatementFlow gives you the answer in seconds — completely free.
          </p>
          <div className="hero-cta-group scroll-animate" style={{ transitionDelay: "0.1s", justifyContent: "center" }}>
            <button
              onClick={scrollToUpload}
              className="btn-gold-pulse"
              style={{
                background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
                color: "#080C14", fontWeight: 600, fontSize: "0.95rem",
                padding: "14px 40px", borderRadius: 50, border: "none", cursor: "pointer",
                letterSpacing: "-0.01em",
                boxShadow: "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(201,168,76,0.45), 0 0 0 4px rgba(201,168,76,0.15), 0 0 0 8px rgba(201,168,76,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35), inset 0 1px 0 rgba(255,255,255,0.1)"; }}
            >
              Convert My Statement Free →
            </button>
          </div>
          {/* Trust icons row */}
          <div className="scroll-animate" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 28px", marginTop: 28, transitionDelay: "0.15s" }}>
            {[["🔒", "No account required"], ["📄", "PDF only — never stored"], ["🇬🇧", "All UK banks supported"]].map(([icon, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "#4A5568" }}>
                <span style={{ fontSize: "0.9rem" }}>{icon}</span> {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          13. FOOTER
      ══════════════════════════════════════════════════════════════ */}
      <footer style={{ backgroundColor: "#040608", borderTop: "1px solid rgba(201,168,76,0.12)" }} className="px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <LogoIcon size={36} />
                <span style={{ color: "#F5F0E8", fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>StatementFlow</span>
              </div>
              <p style={{ color: "#4A5568", fontSize: "0.875rem", lineHeight: 1.65, maxWidth: 240, marginBottom: 16 }}>
                Built for UK bank statements. Free forever.
              </p>
              {/* Social links */}
              <div style={{ display: "flex", gap: 12 }}>
                <a href="https://x.com/statementflow" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)"
                  style={{ width: 36, height: 36, background: "#111820", border: "1px solid #1E2A3A", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#4A5568", textDecoration: "none", transition: "color 0.2s, border-color 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#C9A84C"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#4A5568"; e.currentTarget.style.borderColor = "#1E2A3A"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://linkedin.com/company/statementflow" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                  style={{ width: 36, height: 36, background: "#111820", border: "1px solid #1E2A3A", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#4A5568", textDecoration: "none", transition: "color 0.2s, border-color 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#C9A84C"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#4A5568"; e.currentTarget.style.borderColor = "#1E2A3A"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>

            {/* Links */}
            <div className="md:flex md:justify-center">
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4A5568", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Quick Links</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "How it works", href: "#how-it-works" },
                    { label: "Pricing",      href: "#pricing" },
                    { label: "Security",     href: "#security" },
                    { label: "FAQ",          href: "#faq" },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <a href={href} style={{ fontSize: "0.875rem", color: "#4A5568", textDecoration: "none", transition: "color 0.2s ease" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#C9A84C"}
                        onMouseLeave={e => e.currentTarget.style.color = "#4A5568"}
                      >{label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right */}
            <div className="md:text-right footer-col-right">
              <p style={{ fontSize: "0.875rem", color: "#F5F0E8", fontWeight: 500, marginBottom: 8 }}>Made with care in the UK 🇬🇧</p>
              <p style={{ fontSize: "0.75rem", color: "#4A5568" }}>© 2026 StatementFlow · Free, private, secure.</p>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1E2A3A" }} className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "#C9A84C" }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Zero data retention — your privacy is protected
            </div>
            <p style={{ fontSize: "0.75rem", color: "#4A5568" }}>Built for UK bank statements · Free to use · No account required</p>
          </div>
          <AdminLink />
        </div>
      </footer>
    </div>
  );
}
