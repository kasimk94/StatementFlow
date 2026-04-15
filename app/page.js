"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import UploadZone from "../components/UploadZone";
import Dashboard from "../components/Dashboard";
import Navbar from "../components/Navbar";
import FeedbackPopup from "../components/FeedbackPopup";
import ReviewsSection from "../components/ReviewsSection";

// ── Demo transactions (debits are negative, credits positive) ─────────────────
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

// ── Demo insights (mirrors what the AI would generate) ───────────────────────
const DEMO_INSIGHTS = {
  summary: "You're spending 82% of your income with a healthy £612 surplus this month",
  topInsight: "Over £67/month goes to subscriptions — Netflix, Spotify and Amazon Prime alone cost £29.97",
  spendingScore: 74,
  spendingScoreLabel: "Good",
  subscriptions: {
    total: 67.96,
    list: ["Netflix £10.99", "Spotify £9.99", "Amazon Prime £8.99", "Disney+ £4.99", "Sky £32.00"],
    message: "You spend £67.96/month on subscriptions",
  },
  biggestCategory: {
    name: "Bills & Finance",
    amount: 950.00,
    percentage: 56,
    message: "Your mortgage/rent dominates spending at 56% of expenses",
  },
  savingsOpportunity: {
    message: "Reducing eating out from 5x to 3x per week could save you significantly",
    potentialSaving: "£45 per month",
  },
  unusualSpending: { detected: false, message: "Your spending looks consistent this month" },
  positiveNote: "Well done! You're saving £612 this month — that's 18% of your income",
  alerts: [
    "Amazon appears 4 times — check for duplicate subscriptions",
    "Costa Coffee visits (5×) cost £29.25 this month",
  ],
};

// ── Hidden admin link (visible only at ?admin=true) ──────────────────────────
function AdminLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(new URLSearchParams(window.location.search).get("admin") === "true");
  }, []);
  if (!show) return null;
  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <a
        href="#reviews"
        style={{ fontSize: "0.72rem", color: "#475569", textDecoration: "underline", opacity: 0.6 }}
      >
        Admin: manage reviews
      </a>
    </div>
  );
}

// ── Pricing feature row ───────────────────────────────────────────────────────
function PricingFeature({ text, included, light, dark, comingSoon }) {
  let checkStyle, crossStyle, textStyle, soonStyle;
  if (light) {
    checkStyle = { color: "white" };
    crossStyle = { color: "rgba(255,255,255,0.3)" };
    textStyle  = included ? { color: "rgba(255,255,255,0.9)" } : { color: "rgba(255,255,255,0.35)" };
    soonStyle  = { marginLeft: 6, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" };
  } else if (dark) {
    checkStyle = { color: "#a29bfe" };
    crossStyle = { color: "#2d3a4a" };
    textStyle  = included ? { color: "#cbd5e1" } : { color: "#3d4f63" };
    soonStyle  = { marginLeft: 6, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", background: "rgba(108,99,255,0.12)", color: "#a29bfe", border: "1px solid rgba(108,99,255,0.2)", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" };
  } else {
    checkStyle = { color: "#2563eb" };
    crossStyle = { color: "#cbd5e1" };
    textStyle  = included ? { color: "#334155" } : { color: "#94a3b8" };
    soonStyle  = { marginLeft: 6, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.04em", background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" };
  }
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.875rem" }}>
      {included ? (
        <svg style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, ...checkStyle }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, ...crossStyle }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span style={textStyle}>
        {text}
        {comingSoon && <span style={soonStyle}>SOON</span>}
      </span>
    </li>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
// Gradient container (blue → cyan) with a bar-chart + flowing trend-arrow icon
function LogoIcon({ size = 32 }) {
  const r = Math.round(size * 0.25); // border-radius scales with size
  const s = Math.round(size * 0.56); // inner SVG size
  return (
    <div
      style={{
        width: size, height: size, borderRadius: r, flexShrink: 0,
        background: "linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(37,99,235,0.35)",
      }}
    >
      <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
        {/* Rising bars */}
        <rect x="1"  y="11" width="3" height="6" rx="1" fill="white" fillOpacity="0.65"/>
        <rect x="6"  y="7"  width="3" height="10" rx="1" fill="white" fillOpacity="0.85"/>
        <rect x="11" y="3"  width="3" height="14" rx="1" fill="white"/>
        {/* Flowing trend line */}
        <path d="M2.5 10.5 C5.5 6 9 6.5 12.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        {/* Arrowhead */}
        <path d="M10.5 1.5 L13 2.5 L12 5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );
}

export default function Home() {
  const [transactions,  setTransactions]  = useState(null);
  const [parseResult,   setParseResult]   = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [apiDone,       setApiDone]       = useState(false);
  const [error,         setError]         = useState(null);
  const [showFeedback,  setShowFeedback]  = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const pendingDataRef = useRef(null);

  const { data: session } = useSession();

  const handleCheckout = useCallback(async (plan) => {
    if (!session) {
      window.location.href = "/signup";
      return;
    }
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setCheckoutLoading(null);
    }
  }, [session]);

  const HERO_WORDS = ["Finally Making Sense.", "Giving You Control.", "Decoded For You.", "Clear. Simple. Easy."];
  const HERO_WORD_STYLES = [
    { fontWeight: 400, fontStyle: "normal",  letterSpacing: "0" },
    { fontWeight: 800, fontStyle: "normal",  letterSpacing: "-0.02em" },
    { fontWeight: 400, fontStyle: "italic",  letterSpacing: "0.01em" },
    { fontWeight: 300, fontStyle: "normal",  letterSpacing: "0.05em" },
  ];
  const [animatedWord, setAnimatedWord] = useState(0);
  const [openFaq, setOpenFaq]           = useState(null);
  const [billing, setBilling]           = useState("monthly");
  const [billingFade, setBillingFade]   = useState(true);
  const [hoveredOption, setHoveredOption] = useState(null);


  const PRO_MONTHLY = 4.99;
  const BIZ_MONTHLY = 19.99;
  const PRO_ANNUAL  = (49.99 / 12);   // £49.99/year billed annually
  const BIZ_ANNUAL  = (199.99 / 12);  // £199.99/year billed annually

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

  // ── Always start at top on load/refresh ─────────────────────────────────────
  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  // ── Check localStorage for reviews (client-side only) ────────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("sf_reviews") || "[]");
      setHasReviews(stored.length > 0);
    } catch {}
  }, []);


  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedWord(prev => (prev + 1) % HERO_WORDS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  const [uploadVisible,       setUploadVisible]       = useState(false);
  const [hasReviews,          setHasReviews]          = useState(false);
  const [badgesVisible,       setBadgesVisible]       = useState(false);
  const [faqVisible,          setFaqVisible]          = useState(false);
  const [uploadBadgesVisible, setUploadBadgesVisible] = useState(false);

  const uploadRef       = useRef(null);
  const badgesRef       = useRef(null);
  const faqRef          = useRef(null);
  const uploadBadgesRef = useRef(null);

  // ── Unified scroll-reveal (bidirectional) ───────────────────────────────────
  // Adds "visible" when element enters viewport, removes it when it leaves.
  // No unobserve — elements animate every time they cross the threshold.
  useEffect(() => {
    const els = document.querySelectorAll(".scroll-animate, .anim-scale");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
        } else {
          e.target.classList.remove("visible");
        }
      }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // ── Hero trust badges — bidirectional stagger ────────────────────────────────
  useEffect(() => {
    const el = badgesRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { setBadgesVisible(entry.isIntersecting); },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── Upload section mini-badges — bidirectional stagger ───────────────────────
  useEffect(() => {
    const el = uploadBadgesRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { setUploadBadgesVisible(entry.isIntersecting); },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── FAQ items — bidirectional stagger ────────────────────────────────────────
  useEffect(() => {
    const el = faqRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { setFaqVisible(entry.isIntersecting); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);


  async function handleFile(file) {
    setLoading(true);
    setApiDone(false);
    setError(null);
    setTransactions(null);
    pendingDataRef.current = null;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res  = await fetch("/api/convert", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");
      // Store result — dashboard shown after animation completes
      pendingDataRef.current = data;
      setApiDone(true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setApiDone(false);
    }
  }

  function handleAnimationDone() {
    const data = pendingDataRef.current;
    if (!data) return;
    pendingDataRef.current = null;
    setTransactions(data.transactions);
    setParseResult({
      confidence: data.confidence,
      bank: data.bank,
      debug: data.debug ?? null,
      insights: data.insights ?? null,
      overdraftLimit: data.overdraftLimit ?? 500,
      internalTransferTotal: data.internalTransferTotal ?? 0,
      reversalsCount: data.reversalsCount ?? 0,
      statementIncome: data.totalIncome ?? null,
      statementExpenses: data.totalExpenses ?? null,
      startBalance: data.startBalance ?? null,
      endBalance: data.endBalance ?? null,
      vatSummary: data.vatSummary ?? null,
      period: data.period ?? null,
      realIncome: data.realIncome ?? null,
      realSpending: data.realSpending ?? null,
    });
    setLoading(false);
    setApiDone(false);
    window.scrollTo(0, 0);
  }

  function handleReset() {
    setTransactions(null);
    setError(null);
    setShowFeedback(false);
  }

  // Show feedback popup 10 s after a successful parse (once per session)
  useEffect(() => {
    if (!transactions) return;
    if (sessionStorage.getItem("sf_feedback_shown")) return;
    const t = setTimeout(() => setShowFeedback(true), 10000);
    return () => clearTimeout(t);
  }, [transactions]);

  function closeFeedback() {
    sessionStorage.setItem("sf_feedback_shown", "1");
    setShowFeedback(false);
  }

  function scrollToUpload() {
    setUploadVisible(true);
    setTimeout(() => {
      const el = document.getElementById("get-started");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  // ── Dashboard view (after upload) ─────────────────────────────────────────
  if (transactions) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
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
          />
        </main>
        {showFeedback && <FeedbackPopup onClose={closeFeedback} />}
      </div>
    );
  }

  // ── Landing page ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "#080C14", color: "#F0F4FF" }}>

      <Navbar onScrollToUpload={scrollToUpload} showReviewsLink={hasReviews} />

      {/* ── SEO ── */}
      <p className="visually-hidden">StatementFlow is a free UK bank statement converter that transforms PDF bank statements into Excel reports and spending dashboards. Supporting all major UK banks including Barclays, HSBC, Lloyds, NatWest, Santander, Monzo and Starling.</p>

      {/* ══ SECTION 1: HERO ══ */}
      <section id="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: "#080C14", position: "relative", overflow: "hidden", paddingTop: 80 }}>
        {/* Radial glow */}
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)", width: 900, height: 600, background: "radial-gradient(ellipse at center, rgba(108,99,255,0.18) 0%, rgba(79,158,255,0.06) 40%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: "80px 24px", position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div className="animate-fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.25)", color: "#a29bfe", fontSize: "0.78rem", fontWeight: 700, padding: "7px 18px", borderRadius: 999, marginBottom: 36, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span style={{ width: 6, height: 6, background: "#6C63FF", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 6px #6C63FF" }} />
            No bank logins. No stored data. Ever.
          </div>

          <h1 className="animate-fade-up-delay hero-headline" style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(2rem, 4.5vw, 3.5rem)", fontWeight: 700, lineHeight: 1.2, color: "#F0F4FF", marginBottom: 28 }}>
            Every finance app wants<br />your bank login.<br />
            <span style={{ color: "#6C63FF" }}>StatementFlow just needs a PDF.</span>
          </h1>

          <p className="animate-fade-up-delay-2 hero-subheadline" style={{ color: "#8A9BB5", fontSize: "1.1rem", lineHeight: 1.75, maxWidth: 560, margin: "0 auto 40px" }}>
            Upload your PDF bank statement and get instant clarity —{" "}
            spending categories, AI insights, and clean data ready for your accountant.{" "}
            No account. No data stored. Ever.
          </p>

          <div className="hero-cta-group animate-fade-up-delay-3" style={{ marginBottom: 48 }}>
            <button
              onClick={scrollToUpload}
              style={{ background: "#6C63FF", color: "white", fontWeight: 700, fontSize: "1rem", padding: "15px 36px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 0 32px rgba(108,99,255,0.4), 0 8px 24px rgba(108,99,255,0.25)", minHeight: 52, transition: "box-shadow 0.25s ease, transform 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 48px rgba(108,99,255,0.6), 0 12px 32px rgba(108,99,255,0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 32px rgba(108,99,255,0.4), 0 8px 24px rgba(108,99,255,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Convert My Statement →
            </button>
            <button
              onClick={() => { const el = document.getElementById("how-it-works"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
              style={{ color: "#8A9BB5", fontWeight: 600, fontSize: "1rem", padding: "15px 32px", borderRadius: 999, border: "1px solid #1E2A3A", background: "rgba(255,255,255,0.03)", cursor: "pointer", minHeight: 52, transition: "border-color 0.2s ease, color 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#6C63FF"; e.currentTarget.style.color = "#F0F4FF"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E2A3A"; e.currentTarget.style.color = "#8A9BB5"; }}
            >
              See How It Works
            </button>
          </div>

          {/* Trust row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px", justifyContent: "center", alignItems: "center" }}>
            {["No bank connections — ever", "Files deleted immediately", "Your data is never sold", "Built for privacy by design"].map(text => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#8A9BB5", fontWeight: 500 }}>
                <span style={{ color: "#00D4A0", fontSize: 14 }}>✓</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SECTION 2: PROBLEM ══ */}
      <section className="hp-section" style={{ background: "#0A0E18" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p className="scroll-animate" style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 16 }}>Sound Familiar?</p>
          <h2 className="scroll-animate" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", fontWeight: 800, lineHeight: 1.25, color: "#F0F4FF", marginBottom: 56, transitionDelay: "0.05s" }}>
            Your money is a mystery.<br />It doesn&apos;t have to be.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "left" }}>
            {[
              { icon: "😤", heading: '"Where did my money go this month?"', body: "You check your balance and it's lower than expected. You scroll through transactions and still have no idea.", accent: "#ef4444" },
              { icon: "📊", heading: '"Copy-pasting statements takes hours."', body: "If you're an accountant or business owner, you know the pain of manually cleaning bank data for every client.", accent: "#f97316" },
              { icon: "🔗", heading: '"Open Banking feels risky."', body: "You shouldn't need to hand over your login details just to understand your own finances.", accent: "#eab308" },
            ].map(({ icon, heading, body, accent }, i) => (
              <div key={i} className="scroll-animate" style={{ display: "flex", gap: 20, alignItems: "flex-start", transitionDelay: `${i * 0.1}s`, background: "#0F1521", borderRadius: 16, padding: "24px 28px", borderLeft: `4px solid ${accent}`, border: `1px solid #1E2A3A`, borderLeft: `4px solid ${accent}` }}>
                <span style={{ fontSize: "2rem", flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: "1.05rem", color: "#F0F4FF", margin: "0 0 6px" }}>{heading}</p>
                  <p style={{ color: "#8A9BB5", fontSize: "0.92rem", lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="scroll-animate" style={{ marginTop: 48, fontWeight: 800, fontSize: "1.2rem", color: "#6C63FF" }}>There&apos;s a better way.</p>
        </div>
      </section>

      {/* ══ SECTION 3: HOW IT WORKS ══ */}
      <section id="how-it-works" className="hp-section" style={{ background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 12 }}>How It Works</p>
            <h2 style={{ fontWeight: 800, color: "#0f172a", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>Upload Once. Understand Everything.</h2>
            <p style={{ color: "#64748b", fontSize: "1rem", maxWidth: 560, margin: "0 auto" }}>StatementFlow reads your PDF bank statement and instantly structures it into something you can actually use.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, position: "relative" }}>
            {[
              { num: "01", icon: "📄", title: "Upload your PDF", desc: "Download your statement from your bank app and drop it here. We support all major UK banks including Barclays, HSBC, Lloyds, Monzo, Starling and more." },
              { num: "02", icon: "⚡", title: "We structure it instantly", desc: "Our engine reads every transaction, categorises your spending, detects patterns, and builds your complete financial picture — in seconds." },
              { num: "03", icon: "✓",  title: "You get clarity", desc: "A live spending dashboard, downloadable Excel report, and CSV — ready for budgeting, tracking, or sending straight to your accountant." },
            ].map(({ num, icon, title, desc }, i) => (
              <div key={num} className="scroll-animate" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "36px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", textAlign: "center", transitionDelay: `${i * 0.1}s`, position: "relative" }}>
                <div style={{ fontSize: "4rem", fontWeight: 900, color: "#f1f5f9", lineHeight: 1, marginBottom: 8, userSelect: "none", fontFamily: "var(--font-playfair)" }}>{num}</div>
                <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #f0eeff, #ede9fe)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", margin: "0 auto 16px" }}>{icon}</div>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", margin: "0 0 10px" }}>{title}</h3>
                <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SECTION 4: TWO AUDIENCES ══ */}
      <section className="hp-section" style={{ background: "#080C14" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 12 }}>Who It&apos;s For</p>
            <h2 style={{ fontWeight: 800, color: "#F0F4FF", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 24 }}>Which one are you?</h2>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 32, flexWrap: "wrap" }}>
              <div style={{ padding: "8px 20px", borderRadius: 999, background: "rgba(108,99,255,0.12)", color: "#a29bfe", fontWeight: 600, fontSize: "0.875rem", border: "1px solid rgba(108,99,255,0.3)" }}>
                👤 I manage my own money
              </div>
              <div style={{ padding: "8px 20px", borderRadius: 999, background: "rgba(79,158,255,0.1)", color: "#4F9EFF", fontWeight: 600, fontSize: "0.875rem", border: "1px solid rgba(79,158,255,0.25)" }}>
                📊 I work with client statements
              </div>
            </div>
          </div>
          <div className="audience-cards-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "stretch", maxWidth: 1100, margin: "0 auto" }}>
            {/* Individuals card */}
            <div className="scroll-animate" style={{ background: "#0F1521", border: "1px solid #1E2A3A", borderRadius: 24, padding: "40px 36px", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #6C63FF, #4F9EFF)" }} />
              <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #6C63FF, #4F9EFF)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, flexShrink: 0 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "1.25rem", color: "#F0F4FF", margin: "0 0 6px" }}>Take control of your money</h3>
              <p style={{ color: "#6C63FF", fontWeight: 600, fontSize: "0.82rem", margin: 0 }}>For individuals &amp; families</p>
              <p style={{ color: "#8A9BB5", fontSize: "0.9rem", lineHeight: 1.7, marginTop: 16, marginBottom: 20 }}>Upload your bank statement and finally see exactly where your money goes. Build your own budget tracker using data you trust — not estimates, not guesses. No bank login ever required.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Spending breakdown by category", "Monthly dashboard with insights", "Budget tracker ready to use", "Your data never stored or shared"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "#CBD5E1", fontSize: "0.88rem", fontWeight: 500 }}>
                    <span style={{ color: "#00D4A0", fontWeight: 700 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <div style={{ flex: 1 }} />
              <div style={{ paddingTop: 32 }}>
                <button onClick={scrollToUpload} style={{ width: "100%", textAlign: "center", background: "#6C63FF", color: "white", fontWeight: 600, padding: "14px 24px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.95rem", boxShadow: "0 0 20px rgba(108,99,255,0.3)" }}>Try Free →</button>
              </div>
            </div>
            {/* Accountants card */}
            <div className="scroll-animate" style={{ background: "#0F1521", border: "1px solid #1E2A3A", borderRadius: 24, padding: "40px 36px", transitionDelay: "0.1s", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #4F9EFF, #00D4A0)" }} />
              <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #1e3a5f, #2563eb)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, flexShrink: 0 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "1.25rem", color: "#F0F4FF", margin: "0 0 6px" }}>Turn statements into structured data</h3>
              <p style={{ color: "#4F9EFF", fontWeight: 600, fontSize: "0.82rem", margin: 0 }}>For accountants, bookkeepers &amp; businesses</p>
              <p style={{ color: "#8A9BB5", fontSize: "0.9rem", lineHeight: 1.7, marginTop: 16, marginBottom: 20 }}>Convert any client bank statement into clean, structured data instantly. Ready for reconciliation, VAT prep, and reporting — without a single minute of copy-pasting.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {["Debit & credit split columns", "Tax category mapping", "VAT estimation built in", "Audit-ready reconciliation view"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "#CBD5E1", fontSize: "0.88rem", fontWeight: 500 }}>
                    <span style={{ color: "#00D4A0", fontWeight: 700 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <div style={{ flex: 1 }} />
              <div style={{ paddingTop: 32 }}>
                <button onClick={() => { const el = document.getElementById("how-it-works"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} style={{ width: "100%", textAlign: "center", background: "transparent", color: "#4F9EFF", fontWeight: 600, padding: "14px 24px", borderRadius: 999, border: "1px solid rgba(79,158,255,0.3)", cursor: "pointer", fontSize: "0.95rem" }}>See Business Features →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 5: BEFORE / AFTER ══ */}
      {/* ══ SECTION 5: BEFORE / AFTER ══ */}
      <section className="hp-section" style={{ background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 12 }}>The Transformation</p>
            <h2 style={{ fontWeight: 800, color: "#0f172a", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>From messy PDF to complete clarity</h2>
            <p style={{ color: "#64748b", fontSize: "1rem" }}>This is what happens the moment you upload.</p>
          </div>
          <div className="before-after-grid">
            {/* Before panel */}
            <div className="scroll-animate" style={{ border: "2px solid #fecaca", borderRadius: 20, overflow: "hidden", minHeight: 420, display: "flex", flexDirection: "column", background: "rgba(254,242,242,0.8)" }}>
              <div style={{ background: "#fef2f2", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>YOUR PDF STATEMENT</span>
              </div>
              <div style={{ padding: "20px 20px 16px", flex: 1 }}>
                {[
                  ["03 Mar 2024","FPS OUT JOHN SMITH REF SN2024..","450.00"],
                  ["04 Mar 2024","CARD PAYMENT TO AMZNMKTPLACE*YH7G2...","23.99"],
                  ["04 Mar 2024","DD BARCLAYS PRTNR FIN SRV...","237.38"],
                  ["05 Mar 2024","FASTER PAYMENTS REC'D 004523...","1200.00"],
                  ["06 Mar 2024","CARD PAYMENT TO PAYPAL *PENNYAP...","10.00"],
                ].map(([d,t,a],i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "96px 1fr 64px", gap: 8, padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.85rem", color: "#94a3b8", filter: i > 2 ? `blur(${(i-2)*1.5}px)` : "none", opacity: i > 3 ? 0.3 : 1 }}>
                    <span style={{ whiteSpace: "nowrap" }}>{d}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
                    <span style={{ textAlign: "right" }}>{a}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: "0.72rem", color: "#cbd5e1", fontStyle: "italic" }}>...47 more rows</div>
              </div>
              <p style={{ textAlign: "center", padding: "14px", color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic" }}>A PDF only a bank could love</p>
            </div>

            {/* Arrow */}
            <div className="before-after-arrow-h" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", color: "#6C63FF", fontWeight: 900, lineHeight: 1 }}>→</div>
              <div style={{ fontSize: "0.65rem", color: "#6C63FF", fontWeight: 600, letterSpacing: "0.05em", marginTop: 4 }}>StatementFlow</div>
            </div>
            <div className="before-after-arrow-v" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", color: "#6C63FF", fontWeight: 900, lineHeight: 1 }}>↓</div>
              <div style={{ fontSize: "0.65rem", color: "#6C63FF", fontWeight: 600, letterSpacing: "0.05em", marginTop: 4 }}>StatementFlow</div>
            </div>

            {/* After panel */}
            <div className="scroll-animate" style={{ border: "1px solid #e5e7eb", borderRadius: 20, transitionDelay: "0.1s", minHeight: 420, display: "flex", flexDirection: "column", background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", padding: 24 }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ background: "#dcfce7", color: "#166534", fontSize: "0.7rem", fontWeight: 700, padding: "4px 12px", borderRadius: 999, display: "inline-block", marginBottom: 6, letterSpacing: "0.05em" }}>✓ ANALYSED</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>March 2024 · Barclays</div>
                </div>
                <div style={{ background: "#6C63FF", color: "white", fontSize: "0.7rem", fontWeight: 600, padding: "6px 12px", borderRadius: 999 }}>82 transactions</div>
              </div>
              {/* KPI row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                <div style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", borderRadius: 12, padding: 12, color: "white" }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>Money In</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>£3,522</div>
                </div>
                <div style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", borderRadius: 12, padding: 12, color: "white" }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>Money Out</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>£3,608</div>
                </div>
                <div style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)", borderRadius: 12, padding: 12, color: "white" }}>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>Net</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>-£170</div>
                </div>
              </div>
              {/* Breakdown title */}
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Spending Breakdown</div>
              {/* Category rows with progress bars */}
              {[
                { icon: "🏧", label: "Cash & ATM",       amount: "£810", bar: 100, color: "#78716c" },
                { icon: "📋", label: "Direct Debits",    amount: "£771", bar: 95,  color: "#4f46e5" },
                { icon: "🛍️", label: "Online Shopping", amount: "£282", bar: 35,  color: "#ca8a04" },
                { icon: "🛒", label: "Groceries",        amount: "£224", bar: 28,  color: "#16a34a" },
                { icon: "❤️", label: "Charity",          amount: "£216", bar: 26,  color: "#e11d48" },
              ].map(({ icon, label, amount, bar, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>{icon} {label}</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#111827" }}>{amount}</span>
                  </div>
                  <div style={{ height: 6, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${bar}%`, background: color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
              {/* AI insight box */}
              <div style={{ marginTop: 16, background: "linear-gradient(135deg, #0F1521, #1a1040)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18 }}>✨</span>
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a29bfe", marginBottom: 2 }}>StatementFlow AI</div>
                  <div style={{ fontSize: "0.72rem", color: "#8A9BB5", lineHeight: 1.5 }}>£810 withdrawn as cash — harder to track. Your top category is Cash &amp; ATM at 22%.</div>
                </div>
              </div>
              {/* Caption */}
              <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.72rem", color: "#9ca3af", fontStyle: "italic" }}>✓ Categorised instantly · Your bank never shows this</div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <p style={{ color: "#64748b", fontSize: "1rem", marginBottom: 20 }}>Join people across the UK who&apos;ve stopped guessing and started knowing.</p>
            <button onClick={scrollToUpload} style={{ background: "#6C63FF", color: "white", fontWeight: 700, fontSize: "1rem", padding: "14px 36px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 0 24px rgba(108,99,255,0.4)" }}>
              Convert My Statement Free →
            </button>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6" style={{ backgroundColor: "#080C14" }}>
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12 scroll-animate">
            <p style={{ color: "#6C63FF", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Pricing</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F0F4FF", marginBottom: 12 }}>Simple, Transparent Pricing</h2>
            <p style={{ fontSize: "1.1rem", color: "#8A9BB5" }}>Start free, upgrade when you need more</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center mb-14 scroll-animate" style={{ transitionDelay: "0.1s" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                backgroundColor: "#0F1521",
                border: "1px solid #1E2A3A",
                borderRadius: 9999,
                padding: 4,
                width: "min(340px, 90vw)",
              }}
            >
              {/* Sliding pill */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 4, left: 4,
                  width: "calc(50% - 4px)",
                  height: "calc(100% - 8px)",
                  backgroundColor: "#1E2A3A",
                  borderRadius: 9999,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  transform: billing === "annually" ? "translateX(100%)" : "translateX(0)",
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  pointerEvents: "none",
                }}
              />
              <button
                onClick={() => handleBilling("monthly")}
                onMouseEnter={() => setHoveredOption("monthly")}
                onMouseLeave={() => setHoveredOption(null)}
                style={{
                  flex: 1, position: "relative", zIndex: 1,
                  padding: "9px 0", border: "none", borderRadius: 9999,
                  cursor: "pointer", fontSize: 14, fontWeight: 600,
                  color: billing === "monthly" ? "#F0F4FF" : "#8A9BB5",
                  background: "transparent",
                  transition: "color 0.2s ease",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => handleBilling("annually")}
                onMouseEnter={() => setHoveredOption("annually")}
                onMouseLeave={() => setHoveredOption(null)}
                style={{
                  flex: 1, position: "relative", zIndex: 1,
                  padding: "9px 0", border: "none", borderRadius: 9999,
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 600,
                  color: billing === "annually" ? "#F0F4FF" : "#8A9BB5",
                  background: "transparent",
                  transition: "color 0.2s ease",
                }}
              >
                Annually
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 9999,
                  backgroundColor: billing === "annually" ? "#10b981" : "#064e3b",
                  color: billing === "annually" ? "white" : "#6ee7b7",
                  transition: "background-color 0.25s ease, color 0.25s ease",
                  whiteSpace: "nowrap",
                }}>
                  Save up to 34%
                </span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="pricing-grid-mobile grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-20">

            {/* ── FREE ── */}
            <div
              className="scroll-animate flex flex-col"
              style={{ background: "#0F1521", border: "1px solid #1E2A3A", borderRadius: 20, padding: 32, transition: "transform 0.3s ease, box-shadow 0.3s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Free</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, color: "#F0F4FF", lineHeight: 1 }}>£0</span>
                  <span style={{ color: "#8A9BB5", paddingBottom: 8, fontSize: "0.875rem" }}>/month</span>
                </div>
                <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginTop: 8 }}>Perfect for getting started</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <PricingFeature text="1 PDF upload per month" included dark />
                <PricingFeature text="Up to 100 transactions" included dark />
                <PricingFeature text="Spending dashboard" included dark />
                <PricingFeature text="AI categorisation" included dark />
                <PricingFeature text="3 basic AI insights" included dark />
                <PricingFeature text="Excel export" included={false} dark />
                <PricingFeature text="CSV export" included={false} dark />
                <PricingFeature text="Monthly spending report" included={false} dark />
              </ul>
              <button
                onClick={scrollToUpload}
                style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: "0.875rem", fontWeight: 700, color: "#6C63FF", border: "1px solid rgba(108,99,255,0.35)", background: "transparent", cursor: "pointer", transition: "background 0.2s ease" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(108,99,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                Get Started Free
              </button>
            </div>

            {/* ── PRO (most popular) ── */}
            <div
              className="pricing-card-pro-mobile scroll-animate relative md:-mt-5 md:-mb-5 flex flex-col z-10"
              style={{
                background: "#0F1521",
                border: "1px solid rgba(108,99,255,0.5)",
                boxShadow: "0 0 0 1px rgba(108,99,255,0.15), 0 20px 60px rgba(108,99,255,0.18), inset 0 0 40px rgba(108,99,255,0.04)",
                borderRadius: 20, padding: 32, transitionDelay: "0.1s",
                display: "flex", flexDirection: "column",
                transition: "box-shadow 0.3s ease, transform 0.3s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(108,99,255,0.4), 0 28px 72px rgba(108,99,255,0.32), inset 0 0 60px rgba(108,99,255,0.06)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(108,99,255,0.15), 0 20px 60px rgba(108,99,255,0.18), inset 0 0 40px rgba(108,99,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {/* Top gradient line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #6C63FF, #a29bfe)", borderRadius: "20px 20px 0 0" }} />
              {/* Most Popular badge */}
              <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
                <span style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", fontSize: "0.72rem", fontWeight: 800, padding: "5px 16px", borderRadius: 999, boxShadow: "0 4px 12px rgba(245,158,11,0.35)" }}>✦ Most Popular</span>
              </div>

              <div style={{ marginBottom: 24, marginTop: 16 }}>
                <h3 style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(162,155,254,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Pro</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, color: "#F0F4FF", lineHeight: 1, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>
                    £{billing === "monthly" ? PRO_MONTHLY.toFixed(2) : PRO_ANNUAL.toFixed(2)}
                  </span>
                  <span style={{ color: "rgba(162,155,254,0.5)", paddingBottom: 8, fontSize: "0.875rem", opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>/month</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "rgba(162,155,254,0.45)", marginTop: 2, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>
                  {billing === "annually" ? <><span style={{ color: "#00D4A0", fontWeight: 700 }}>Save £10</span> · billed £49.99 annually</> : <>&nbsp;</>}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginTop: 8 }}>For individuals who want full control</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <PricingFeature text="Unlimited uploads" included light />
                <PricingFeature text="Unlimited transactions" included light />
                <PricingFeature text="Full spending dashboard" included light />
                <PricingFeature text="Unlimited AI categorisation" included light />
                <PricingFeature text="Full AI insights" included light />
                <PricingFeature text="Excel & CSV export" included light />
                <PricingFeature text="Monthly spending report" included light />
                <PricingFeature text="3 months statement history" included light />
              </ul>
              <button
                style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: "0.875rem", fontWeight: 700, color: "white", background: "#6C63FF", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(108,99,255,0.4)", transition: "box-shadow 0.2s ease", opacity: checkoutLoading === "PRO" ? 0.6 : 1 }}
                onClick={() => handleCheckout("PRO")}
                disabled={checkoutLoading === "PRO"}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(108,99,255,0.65)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(108,99,255,0.4)"; }}
              >
                {checkoutLoading === "PRO" ? "Redirecting…" : "Start Pro"}
              </button>
            </div>

            {/* ── BUSINESS ── */}
            <div
              className="scroll-animate flex flex-col"
              style={{ background: "#0F1521", border: "1px solid #1E2A3A", borderRadius: 20, padding: 32, transitionDelay: "0.2s", transition: "transform 0.3s ease, box-shadow 0.3s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Business</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "3rem", fontWeight: 800, color: "#F0F4FF", lineHeight: 1, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>
                    £{billing === "monthly" ? BIZ_MONTHLY.toFixed(2) : BIZ_ANNUAL.toFixed(2)}
                  </span>
                  <span style={{ color: "#8A9BB5", paddingBottom: 8, fontSize: "0.875rem", opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>/month</span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginTop: 2, opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>
                  {billing === "annually" ? <><span style={{ color: "#00D4A0", fontWeight: 700 }}>Save £40</span> · billed £199.99 annually</> : <>&nbsp;</>}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginTop: 8 }}>For accountants &amp; small businesses</p>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                <PricingFeature text="Everything in Pro" included dark />
                <PricingFeature text="12 months statement history" included dark />
                <PricingFeature text="Multiple bank accounts" included dark comingSoon />
                <PricingFeature text="AI chat assistant" included dark comingSoon />
                <PricingFeature text="Business expense tagging" included dark comingSoon />
                <PricingFeature text="Priority support" included dark />
              </ul>
              <button
                style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: "0.875rem", fontWeight: 700, color: "white", background: "linear-gradient(135deg, #1e3a5f, #2563eb)", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(37,99,235,0.3)", opacity: checkoutLoading === "BUSINESS" ? 0.6 : 1 }}
                onClick={() => handleCheckout("BUSINESS")}
                disabled={checkoutLoading === "BUSINESS"}
              >
                {checkoutLoading === "BUSINESS" ? "Redirecting…" : "Start Business"}
              </button>
            </div>

          </div>

          {/* FAQ link */}
          <div className="text-center py-6">
            <a
              href="#faq"
              onClick={(e) => { e.preventDefault(); document.getElementById("faq").scrollIntoView({ behavior: "smooth" }); }}
              style={{ fontSize: "0.875rem", color: "#8A9BB5", textDecoration: "none", transition: "color 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#F0F4FF"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#8A9BB5"; }}
            >
              Have questions? See our FAQ below ↓
            </a>
          </div>

        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6" style={{ backgroundColor: "#0A0E18" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 scroll-animate">
            <p style={{ color: "#6C63FF", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Features</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F0F4FF" }}>
              Everything you need to understand<br className="hidden sm:block" /> your finances
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { emoji: "📊", title: "Spending Dashboard",  desc: "Visual charts, donut graphs, and category breakdown with one-click filtering.",                      accent: "#6C63FF" },
              { emoji: "📥", title: "Excel Export",        desc: "Beautifully formatted 3-sheet workbook with charts, totals, and a monthly summary.",                  accent: "#00D4A0" },
              { emoji: "🏷️", title: "Auto Categories",    desc: "12+ spending categories automatically applied — groceries, transport, bills, and more.",               accent: "#4F9EFF" },
              { emoji: "🔒", title: "Zero Storage",        desc: "Your data never touches our servers. Everything is processed in-memory and discarded immediately.",    accent: "#00D4A0" },
              { emoji: "🏦", title: "Any UK Bank",         desc: "Works with Barclays, HSBC, Lloyds, NatWest, Monzo, Starling, and more.",                             accent: "#a29bfe" },
              { emoji: "⚡", title: "Instant Results",     desc: "Processing takes under 10 seconds. No waiting, no queues, no sign-up required.",                      accent: "#f59e0b" },
            ].map(({ emoji, title, desc, accent }, idx) => (
              <div
                key={title}
                className="anim-scale"
                style={{
                  transitionDelay: `${idx * 0.15}s`,
                  background: "#0F1521",
                  border: "1px solid #1E2A3A",
                  borderLeft: `3px solid ${accent}`,
                  borderRadius: 16, padding: 24,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px ${accent}25`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ width: 48, height: 48, background: `${accent}1a`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: 16 }}>
                  {emoji}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#F0F4FF", marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#8A9BB5" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <ReviewsSection onScrollToUpload={scrollToUpload} />

      {/* ══ SECTION 6: SOCIAL PROOF BAR ══ */}
      <section style={{ background: "#0F1521", borderTop: "1px solid #1E2A3A", borderBottom: "1px solid #1E2A3A", padding: "22px 24px" }}>
        <div className="social-proof-bar" style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#F0F4FF", fontSize: "0.95rem" }}>Trusted by individuals and accountants across the UK</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            {["All major UK banks supported", "Free forever · No signup", "PDF to Excel in seconds"].map((t, i) => (
              <span key={i} style={{ fontSize: "0.8rem", color: "#6C63FF", fontWeight: 600 }}>· {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section id="security" className="py-20 px-6" style={{ background: "#F8FAFC" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 12 }}>Security &amp; Privacy</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#0f172a" }}>Built on Zero-Knowledge Architecture</h2>
            <p style={{ fontSize: "1.1rem", color: "#64748b", marginTop: 16, maxWidth: 480, margin: "16px auto 0" }}>
              Your financial data never leaves your device. We process everything in-memory and delete it instantly.
            </p>
          </div>

          {/* Trust Seal */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", border: "2px solid #6C63FF", borderRadius: 16, padding: "24px 32px", background: "white", boxShadow: "0 4px 24px rgba(108,99,255,0.1)", maxWidth: 280 }}>
              <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #6C63FF, #4f46e5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 24 }}>🔒</div>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", margin: "0 0 4px 0", textAlign: "center" }}>Zero-Knowledge Architecture</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 12px 0", textAlign: "center" }}>Verified Privacy Standard</p>
              <div style={{ width: "100%", height: 1, background: "#e2e8f0", margin: "0 0 12px 0" }} />
              <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: 0, textAlign: "center", letterSpacing: "0.05em" }}>STATEMENTFLOW · UK</p>
            </div>
          </div>

          {/* Feature cards — 2×2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 security-grid-2col">
            {[
              { emoji: "🧠", title: "Local-First Processing",      desc: "Your PDF is processed entirely in your browser session. No data is sent to external servers for storage — ever.",      accent: "#6C63FF" },
              { emoji: "🔑", title: "Zero-Knowledge Architecture", desc: "We never see your transactions. Our system processes data in isolated memory that is wiped the moment your session ends.", accent: "#4F9EFF" },
              { emoji: "🇬🇧", title: "UK Privacy Compliant",       desc: "Built to exceed UK GDPR standards. No cookies tracking your financial behaviour, no third-party data sharing.",          accent: "#00D4A0" },
              { emoji: "✓",  title: "No Account Required",        desc: "We don't collect your name, email, or any personal information. Upload, analyse, download, done.",                        accent: "#16a34a" },
            ].map(({ emoji, title, desc, accent }, idx) => (
              <div
                key={title}
                style={{ transitionDelay: `${idx * 0.1}s`, background: "white", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", borderLeft: `4px solid ${accent}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                className="anim-scale"
              >
                <div style={{ width: 48, height: 48, background: `${accent}18`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: 16 }}>
                  {emoji}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a", marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.65, color: "#64748b" }}>{desc}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ══ SECTION 7: COMPARISON TABLE ══ */}
      <section className="hp-section" style={{ background: "#F8FAFC" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6C63FF", textTransform: "uppercase", marginBottom: 12 }}>Why StatementFlow</p>
            <h2 style={{ fontWeight: 800, color: "#0f172a", fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>The smarter way to handle your statement</h2>
            <p style={{ color: "#64748b", fontSize: "1rem" }}>See how we compare to the alternatives.</p>
          </div>
          <p className="comparison-table-hint">← Scroll to see more →</p>
          <div className="scroll-animate comparison-table-wrap" style={{ transitionDelay: "0.05s", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
            <table className="comparison-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ background: "#f8fafc", padding: "14px 20px", textAlign: "left", fontSize: "0.8rem", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Feature</th>
                  <th style={{ background: "linear-gradient(135deg, #6C63FF, #4f46e5)", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "white", borderBottom: "1px solid #4f46e5" }}>StatementFlow</th>
                  <th style={{ background: "#f8fafc", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Manual Copy-Paste</th>
                  <th style={{ background: "#f8fafc", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Open Banking Apps</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Instant results",           "✅", "❌", "⚠️"],
                  ["No bank login required",    "✅", "✅", "❌"],
                  ["Spending categorisation",   "✅", "❌", "✅"],
                  ["Excel & CSV export",        "✅", "⚠️", "❌"],
                  ["Accountant-ready data",     "✅", "❌", "❌"],
                  ["Zero data stored",          "✅", "✅", "❌"],
                  ["Works with all UK banks",   "✅", "✅", "⚠️"],
                  ["VAT estimation",            "✅", "❌", "❌"],
                  ["Free to use",               "✅", "✅", "❌"],
                ].map(([feature, sf, mc, ob], i, arr) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                    <td style={{ padding: "13px 20px", fontSize: "0.88rem", fontWeight: 500, color: "#0f172a", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>{feature}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "1.1rem", background: i % 2 === 0 ? "#faf8ff" : "#f5f0ff", borderBottom: i < arr.length - 1 ? "1px solid #ede9fe" : "none" }}>{sf}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "1.1rem", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>{mc}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "1.1rem", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>{ob}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: "center", padding: "12px 0", fontSize: "0.75rem", color: "#94a3b8", background: "#f8fafc" }}>⚠️ = partial support or varies by provider</p>
          </div>
        </div>
      </section>

      {/* ── UPLOAD SECTION ── hidden until CTA clicked ── */}
      <section
        ref={uploadRef}
        id="get-started"
        className="px-6"
        style={{
          overflow:   "hidden",
          maxHeight:  uploadVisible ? "900px" : "0",
          transition: uploadVisible ? "max-height 0.6s ease" : "none",
          background: "#0A0E18",
        }}
      >
        <div
          className="max-w-2xl mx-auto text-center"
          style={{
            padding:    "96px 0",
            opacity:    uploadVisible ? 1 : 0,
            transform:  uploadVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.5s ease 0.15s, transform 0.5s ease 0.15s",
          }}
        >
          <p style={{ color: "#6C63FF", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Get Started</p>
          <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F0F4FF", marginBottom: 16 }}>Ready to get started?</h2>
          <p style={{ color: "#8A9BB5", marginBottom: 40 }}>
            Drop your PDF below. No sign-up, no credit card, no data stored — ever.
          </p>

          <div className="flex justify-center">
            <UploadZone onFile={handleFile} loading={loading} apiDone={apiDone} onAnimationDone={handleAnimationDone} error={error} />
          </div>

          {error && !/scanned|image.based|could not read this pdf/i.test(error) && (
            <div className="mt-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 max-w-lg mx-auto text-left">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-sm">Could not parse statement</p>
                <p className="text-sm mt-0.5 text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Mini trust badges */}
          <div ref={uploadBadgesRef} className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs" style={{ color: "#8A9BB5" }}>
            {[
              { d: "M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", label: "Your file is never uploaded to any server" },
              { d: "M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z", label: "Processed in-memory, deleted immediately" },
              { d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", label: "No account or sign-up required" },
            ].map(({ d, label }, i) => (
              <span
                key={label}
                className="flex items-center gap-1.5"
                style={{
                  opacity:    uploadBadgesVisible ? 1 : 0,
                  transform:  uploadBadgesVisible ? "scale(1)" : "scale(0.85)",
                  transition: `opacity 0.4s ease-out ${i * 0.12}s, transform 0.4s ease-out ${i * 0.12}s`,
                }}
              >
                <svg className="w-4 h-4" style={{ color: "#00D4A0" }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d={d} clipRule="evenodd" />
                </svg>
                {label}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" aria-label="Frequently Asked Questions" className="pt-24 pb-16 px-6" style={{ background: "#F8FAFC" }}>
        <div className="max-w-2xl mx-auto">

          <div className="text-center mb-12 scroll-animate">
            <p style={{ color: "#6C63FF", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>FAQ</p>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#0f172a" }}>Frequently Asked Questions</h2>
          </div>

          <div ref={faqRef} style={{ borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", background: "white", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            {FAQS.map(({ q, a }, i) => (
              <div
                key={i}
                style={{
                  borderBottom: i < FAQS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity:    faqVisible ? 1 : 0,
                  transform:  faqVisible ? "translateX(0)" : "translateX(-30px)",
                  transition: `opacity 0.5s ease-out ${i * 0.1}s, transform 0.5s ease-out ${i * 0.1}s`,
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 24px", textAlign: "left", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a" }}>{q}</span>
                  <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "1.1rem", fontWeight: 300, transition: "transform 0.2s ease", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 24px 20px", paddingTop: 16, fontSize: "0.875rem", color: "#64748b", lineHeight: 1.7, borderTop: "1px solid #f1f5f9" }}>{a}</div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ══ SECTION 8: FINAL CTA ══ */}
      <section className="hp-section" style={{ background: "#080C14", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(108,99,255,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <h2 className="scroll-animate final-cta-headline" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 800, color: "#F0F4FF", lineHeight: 1.2, marginBottom: 20 }}>
            Your bank statement is trying<br />to tell you something.
          </h2>
          <p className="scroll-animate" style={{ color: "#8A9BB5", fontSize: "1.1rem", lineHeight: 1.75, marginBottom: 40, transitionDelay: "0.05s" }}>
            Every month you pay for things you&apos;ve forgotten. Every month you wonder where it all went. StatementFlow gives you the answer in seconds — completely free.
          </p>
          <div className="hero-cta-group scroll-animate" style={{ transitionDelay: "0.1s" }}>
            <button
              onClick={scrollToUpload}
              style={{ background: "#6C63FF", color: "white", fontWeight: 800, fontSize: "1rem", padding: "16px 36px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 0 32px rgba(108,99,255,0.5), 0 8px 24px rgba(108,99,255,0.3)", minHeight: 52, transition: "box-shadow 0.25s ease, transform 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 48px rgba(108,99,255,0.7), 0 12px 32px rgba(108,99,255,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 32px rgba(108,99,255,0.5), 0 8px 24px rgba(108,99,255,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Convert My Statement Free →
            </button>
            <button
              onClick={() => { const el = document.getElementById("how-it-works"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
              style={{ fontWeight: 600, fontSize: "1rem", padding: "16px 32px", borderRadius: 999, border: "1px solid #1E2A3A", background: "rgba(255,255,255,0.04)", color: "#8A9BB5", cursor: "pointer", minHeight: 52 }}
            >
              See How It Works
            </button>
          </div>
          <p className="scroll-animate" style={{ color: "#8A9BB5", opacity: 0.6, fontSize: "0.8rem", marginTop: 28, transitionDelay: "0.15s" }}>
            Free forever · No account · No bank login · No data stored
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ backgroundColor: "#060A12", borderTop: "1px solid #1E2A3A" }} className="px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

            {/* Left – brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <LogoIcon size={36} />
                <span style={{ color: "#F0F4FF", fontWeight: 700, fontSize: "1.125rem" }}>StatementFlow</span>
              </div>
              <p style={{ color: "#8A9BB5", fontSize: "0.875rem", lineHeight: 1.65, maxWidth: 240 }}>
                Finally understand your money.
              </p>
            </div>

            {/* Middle – quick links */}
            <div className="md:flex md:justify-center">
              <div>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Quick Links</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "How it works", href: "#how-it-works" },
                    { label: "Pricing",      href: "#pricing" },
                    { label: "Security",     href: "#security" },
                    { label: "FAQ",          href: "#faq" },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <a
                        href={href}
                        style={{ fontSize: "0.875rem", color: "#8A9BB5", textDecoration: "none", transition: "color 0.2s ease" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#F0F4FF"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#8A9BB5"; }}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right */}
            <div className="md:text-right footer-col-right">
              <p style={{ fontSize: "0.875rem", color: "#F0F4FF", fontWeight: 500, marginBottom: 8 }}>Made with ❤️ in the UK</p>
              <p style={{ fontSize: "0.75rem", color: "#8A9BB5" }}>© 2026 StatementFlow. All rights reserved.</p>
            </div>

          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1E2A3A" }} className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "#00D4A0" }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Zero data retention — your privacy is protected
            </div>
            <p style={{ fontSize: "0.75rem", color: "#8A9BB5" }}>Built for UK bank statements · Free to use · No account required</p>
          </div>
          {/* Hidden admin link — only visible at ?admin=true */}
          <AdminLink />
        </div>
      </footer>

    </div>
  );
}
