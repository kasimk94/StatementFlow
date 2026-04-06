"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
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
function PricingFeature({ text, included, light }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {included ? (
        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${light ? "text-white" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className={`w-4 h-4 mt-0.5 shrink-0 ${light ? "text-white/30" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={included ? (light ? "text-white/90" : "text-slate-700") : (light ? "text-white/35" : "text-slate-400")}>
        {text}
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
  const pendingDataRef = useRef(null);

  const CYCLING_WORDS = [
    { text: "Clarity",        icon: "✨" },
    { text: "Insights",       icon: "📊" },
    { text: "A Dashboard",    icon: "🖥️" },
    { text: "An Excel Report", icon: "📥" },
  ];
  const [wordIndex, setWordIndex] = useState(0);
  const [animState, setAnimState] = useState("in"); // "in" | "out"
  const [openFaq, setOpenFaq]           = useState(null);
  const [billing, setBilling]           = useState("monthly");
  const [billingFade, setBillingFade]   = useState(true);
  const [hoveredOption, setHoveredOption] = useState(null);


  const PRO_MONTHLY = 7.99;
  const BIZ_MONTHLY = 25.99;
  const PRO_ANNUAL  = 4.99;
  const BIZ_ANNUAL  = 19.99;

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


  useEffect(() => {
    const interval = setInterval(() => {
      setAnimState("out");
      setTimeout(() => {
        setWordIndex(i => (i + 1) % CYCLING_WORDS.length);
        setAnimState("in");
      }, 500); // matches wordOut duration
    }, 2500);
    return () => clearInterval(interval);
  }, []);
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
    const el = document.getElementById("get-started");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Dashboard view (after upload) ─────────────────────────────────────────
  if (transactions) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="dash-header-inner max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              href="/"
              onClick={(e) => { e.preventDefault(); handleReset(); window.scrollTo(0, 0); }}
              className="flex items-center gap-2.5"
              style={{ textDecoration: "none", cursor: "pointer" }}
            >
              <LogoIcon size={32} />
              <span className="text-lg font-bold text-slate-900">StatementFlow</span>
            </Link>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-4 py-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload another
            </button>
          </div>
        </header>
        <main className="dash-main-inner max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Your Statement</h2>
            <p className="text-slate-500 text-sm mt-1">{transactions.length} transactions found</p>
          </div>
          <Dashboard
            transactions={transactions}
            confidence={parseResult?.confidence}
            bank={parseResult?.bank}
            debug={parseResult?.debug}
            insights={parseResult?.insights}
            overdraftLimit={parseResult?.overdraftLimit ?? 500}
            internalTransferTotal={parseResult?.internalTransferTotal ?? 0}
            reversalsCount={parseResult?.reversalsCount ?? 0}
          />
        </main>
        {showFeedback && <FeedbackPopup onClose={closeFeedback} />}
      </div>
    );
  }

  // ── Landing page ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">

      <Navbar onScrollToUpload={scrollToUpload} />

      {/* ── HERO ── */}
      <section id="hero" className="pt-28 pb-20 px-6 text-center" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}>
        <div className="max-w-4xl mx-auto">
          {/* Visually hidden SEO paragraph — accessible to screen readers and crawlers */}
          <p className="visually-hidden">
            StatementFlow is a free UK bank statement converter that transforms PDF bank statements into Excel reports and spending dashboards. Supporting all major UK banks including Barclays, HSBC, Lloyds, NatWest, Santander, Monzo and Starling.
          </p>
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-10 scroll-animate">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Free · No account required · Instant results
          </div>

          <h1
            className="hero-headline font-extrabold text-slate-900 leading-tight tracking-tight mb-8"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3.5rem)" }}
          >
            <span className="block scroll-animate" style={{ transitionDelay: "0.1s" }}>Turn Any Bank Statement Into</span>
            <span className="block scroll-animate" style={{ height: "1.35em", transitionDelay: "0.2s" }}>
              {/*
                Container: no overflow:hidden so the word is never clipped.
                The word is centred via left:50% + translateX(-50%) inside the
                keyframe, so it stays centred regardless of its width.
              */}
              <span
                style={{
                  display: "inline-block",
                  minWidth: "10ch",
                  verticalAlign: "bottom",
                  height: "1.35em",
                  position: "relative",
                }}
              >
                <span
                  key={wordIndex}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3em",
                    position: "absolute",
                    left: "50%",
                    whiteSpace: "nowrap",
                    animation: animState === "in"
                      ? "wordInC 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards"
                      : "wordOutC 0.5s cubic-bezier(0.55, 0, 0.45, 1) forwards",
                  }}
                >
                  <span style={{ fontSize: "0.85em", lineHeight: 1 }}>
                    {CYCLING_WORDS[wordIndex].icon}
                  </span>
                  <span className="text-blue-600" style={{ fontWeight: "inherit" }}>
                    {CYCLING_WORDS[wordIndex].text}
                  </span>
                </span>
              </span>
            </span>
          </h1>

          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 scroll-animate" style={{ lineHeight: 1.75, transitionDelay: "0.3s" }}>
            Upload any UK bank statement PDF and instantly get a spending dashboard, category insights, and a formatted Excel report — in seconds.
          </p>

          {/* CTA buttons */}
          <div className="hero-cta-group mb-14 scroll-animate" style={{ transitionDelay: "0.4s" }}>
            <button
              onClick={scrollToUpload}
              className="flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-9 py-4 rounded-2xl text-base shadow-xl shadow-blue-200/60 btn-primary"
              style={{ minHeight: 52 }}
            >
              Convert My Statement
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button
              onClick={() => { const el = document.getElementById("demo-preview"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className="flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-9 py-4 rounded-2xl text-base shadow-sm btn-secondary"
              style={{ minHeight: 52, justifyContent: "center" }}
            >
              See Example
            </button>
          </div>

          {/* Trust badges — staggered pop-in via IntersectionObserver */}
          <div ref={badgesRef} className="flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: "🔒", text: "Bank-level security" },
              { icon: "⚡", text: "Results in seconds" },
              { icon: "🗑️", text: "Data deleted instantly" },
              { icon: "✅", text: "No account needed" },
            ].map(({ icon, text }, i) => (
              <span
                key={text}
                className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm"
                style={{
                  opacity:    badgesVisible ? 1 : 0,
                  transform:  badgesVisible ? "scale(1)" : "scale(0.82)",
                  transition: `opacity 0.4s ease-out ${i * 0.15}s, transform 0.4s ease-out ${i * 0.15}s`,
                }}
              >
                <span className="text-base leading-none">{icon}</span>
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* ── DEMO DASHBOARD ── */}
        <div id="demo-preview" className="mt-24 pb-10 px-6 scroll-animate" style={{ transitionDelay: "0.5s" }}>
          <div className="text-center mb-10">
            <p className="text-blue-600 font-bold text-xs uppercase tracking-widest mb-3">Live Preview</p>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">See exactly what you'll get</h2>
            <p className="text-slate-500 text-base">Here's a real example of your dashboard after uploading a statement</p>
          </div>

          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {/* Demo banner */}
            <div className="demo-banner-row" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              background: "#fffbeb", borderTop: "1px solid #fde68a", borderLeft: "1px solid #fde68a", borderRight: "1px solid #fde68a",
              padding: "11px 20px", borderRadius: "16px 16px 0 0",
            }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#92400e", display: "flex", alignItems: "center", gap: 7 }}>
                <span>👀</span> This is a live demo with sample data
              </span>
              <button
                onClick={scrollToUpload}
                style={{
                  fontSize: "0.82rem", fontWeight: 700, color: "#92400e",
                  background: "#fde68a", border: "none", borderRadius: 8,
                  padding: "6px 14px", cursor: "pointer", transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fcd34d"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fde68a"; }}
              >
                Try with your own statement →
              </button>
            </div>

            {/* Dashboard card */}
            <div className="demo-card-inner" style={{
              position: "relative",
              background: "#f8fafc",
              border: "1px solid #fde68a",
              borderTop: "none",
              borderRadius: "0 0 20px 20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
              padding: "28px 28px 32px",
            }}>
              {/* DEMO badge */}
              <div
                title="Sample data — upload your PDF to see your real results"
                style={{
                  position: "absolute", top: 18, right: 22, zIndex: 10,
                  background: "#fdcb6e", color: "#1a1a2e",
                  fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.05em",
                  padding: "4px 10px", borderRadius: 20,
                  boxShadow: "0 2px 8px rgba(253,203,110,0.45)",
                  display: "flex", alignItems: "center", gap: 4,
                  cursor: "default", userSelect: "none",
                }}
              >
                ✨ DEMO
              </div>

              <Dashboard transactions={DEMO_TRANSACTIONS} demoMode={true} insights={DEMO_INSIGHTS} />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="pt-14 pb-4 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 scroll-animate">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Simple Process</p>
            <h2 className="text-4xl font-extrabold text-slate-900">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line — thicker, blue */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%+40px)] right-[calc(16.67%+40px)] h-0.5 bg-blue-200" style={{ top: 40 }} />
            {[
              { step: "01", emoji: "📤", title: "Upload",   desc: "Drop your PDF bank statement into the secure upload zone. We accept all major UK bank formats.", detail: "PDF, up to 10MB. No account needed." },
              { step: "02", emoji: "⚡", title: "Analyse",  desc: "Our parser extracts and categorises every transaction automatically across 12+ spending categories.", detail: "Works with Barclays, HSBC, Lloyds, NatWest, Monzo & more." },
              { step: "03", emoji: "📊", title: "Download", desc: "Instantly get your interactive dashboard and a beautifully formatted 3-sheet Excel workbook.", detail: "Excel workbook with 3 sheets — Dashboard, Transactions, Categories." },
            ].map(({ step, emoji, title, desc, detail }, idx) => (
              <div key={step} className="scroll-animate relative text-center bg-white border border-slate-100 rounded-2xl px-6 py-8 shadow-sm hover:shadow-md transition-shadow" style={{ transitionDelay: `${idx * 0.15}s` }}>
                <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-3xl mx-auto mb-6 relative z-10">
                  {emoji}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    {step.replace("0","")}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto mb-3">{desc}</p>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-6" style={{ backgroundColor: "#f8faff" }}>
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-12 scroll-animate">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-3">Simple, Transparent Pricing</h2>
            <p className="text-xl text-slate-500">Start free, upgrade when you need more</p>
          </div>

          {/* Billing toggle — iOS-style sliding pill */}
          <div className="flex items-center justify-center mb-14 scroll-animate" style={{ transitionDelay: "0.1s" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                backgroundColor: "#e8edf5",
                borderRadius: 9999,
                padding: 4,
                width: 340,
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.10)",
              }}
            >
              {/* Sliding white pill — moves under the active label */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  width: "calc(50% - 4px)",
                  height: "calc(100% - 8px)",
                  backgroundColor: "white",
                  borderRadius: 9999,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.13)",
                  transform: billing === "annually" ? "translateX(100%)" : "translateX(0)",
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  pointerEvents: "none",
                }}
              />
              {/* Monthly */}
              <button
                onClick={() => handleBilling("monthly")}
                onMouseEnter={() => setHoveredOption("monthly")}
                onMouseLeave={() => setHoveredOption(null)}
                style={{
                  flex: 1,
                  position: "relative",
                  zIndex: 1,
                  padding: "9px 0",
                  border: "none",
                  borderRadius: 9999,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: billing === "monthly" ? "#0f172a" : hoveredOption === "monthly" ? "#475569" : "#94a3b8",
                  background: billing !== "monthly" && hoveredOption === "monthly" ? "rgba(100,116,139,0.10)" : "transparent",
                  transition: "color 0.2s ease, background 0.2s ease",
                }}
              >
                Monthly
              </button>
              {/* Annually */}
              <button
                onClick={() => handleBilling("annually")}
                onMouseEnter={() => setHoveredOption("annually")}
                onMouseLeave={() => setHoveredOption(null)}
                style={{
                  flex: 1,
                  position: "relative",
                  zIndex: 1,
                  padding: "9px 0",
                  border: "none",
                  borderRadius: 9999,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: billing === "annually" ? "#0f172a" : hoveredOption === "annually" ? "#475569" : "#94a3b8",
                  background: billing !== "annually" && hoveredOption === "annually" ? "rgba(100,116,139,0.10)" : "transparent",
                  transition: "color 0.2s ease, background 0.2s ease",
                }}
              >
                Annually
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: 9999,
                    backgroundColor: billing === "annually" ? "#10b981" : "#d1fae5",
                    color: billing === "annually" ? "white" : "#065f46",
                    transition: "background-color 0.25s ease, color 0.25s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  Save up to 37%
                </span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="pricing-grid-mobile grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch mb-20">

            {/* ── FREE ── */}
            <div className="scroll-animate bg-white rounded-[20px] border border-slate-200 shadow-sm p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Free</h3>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-extrabold text-slate-900">£0</span>
                  <span className="text-slate-400 pb-2 text-sm">/month</span>
                </div>
                <p className="text-sm text-slate-400 mt-2">Perfect for occasional use</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                <PricingFeature text="3 PDF uploads per month" included />
                <PricingFeature text="Basic transaction dashboard" included />
                <PricingFeature text="CSV export" included />
                <PricingFeature text="Spending categories" included />
                <PricingFeature text="Excel export" included={false} />
                <PricingFeature text="Priority processing" included={false} />
                <PricingFeature text="Email support" included={false} />
              </ul>
              <button
                onClick={scrollToUpload}
                className="w-full py-3 rounded-xl text-sm font-bold text-blue-600 border-2 border-blue-600 hover:bg-blue-50 transition-colors"
              >
                Get Started Free
              </button>
            </div>

            {/* ── PRO (most popular) ── */}
            <div
              className="pricing-card-pro-mobile scroll-animate relative md:-mt-5 md:-mb-5 flex flex-col rounded-[20px] p-8 transition-all duration-300 hover:-translate-y-1 z-10"
              style={{
                background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                boxShadow: "0 20px 60px rgba(108,92,231,0.35)",
                transitionDelay: "0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 30px 72px rgba(108,92,231,0.52)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 20px 60px rgba(108,92,231,0.35)"; }}
            >
              {/* Most Popular badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="bg-amber-400 text-amber-900 text-xs font-extrabold px-4 py-1.5 rounded-full shadow-md">
                  ✦ Most Popular
                </span>
              </div>

              <div className="mb-6 mt-4">
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Pro</h3>
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-5xl font-extrabold text-white"
                    style={{ opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}
                  >
                    £{billing === "monthly" ? PRO_MONTHLY.toFixed(2) : PRO_ANNUAL.toFixed(2)}
                  </span>
                  <span className="text-white/50 pb-2 text-sm" style={{ opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>/month</span>
                </div>
                <p
                  className="text-xs text-white/50 mt-0.5"
                  style={{ opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}
                >
                  {billing === "annually"
                    ? <><span className="text-emerald-300 font-bold">Save 37%</span> · billed £59.88 annually</>
                    : <>&nbsp;</>}
                </p>
                <p className="text-sm text-white/60 mt-2">For regular personal use</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                <PricingFeature text="Unlimited PDF uploads" included light />
                <PricingFeature text="Advanced dashboard & insights" included light />
                <PricingFeature text="Excel & CSV export" included light />
                <PricingFeature text="Premium Excel report formatting" included light />
                <PricingFeature text="Spending trends & charts" included light />
                <PricingFeature text="Priority processing" included light />
                <PricingFeature text="Multi-user access" included={false} light />
                <PricingFeature text="API access" included={false} light />
              </ul>
              <button className="w-full py-3 rounded-xl text-sm font-bold text-indigo-700 bg-white hover:bg-slate-50 transition-colors shadow-md">
                Start Pro
              </button>
            </div>

            {/* ── BUSINESS ── */}
            <div
              className="scroll-animate bg-white rounded-[20px] border border-slate-200 shadow-sm p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              style={{ transitionDelay: "0.2s" }}
            >
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Business</h3>
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-5xl font-extrabold text-slate-900"
                    style={{ opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}
                  >
                    £{billing === "monthly" ? BIZ_MONTHLY.toFixed(2) : BIZ_ANNUAL.toFixed(2)}
                  </span>
                  <span className="text-slate-400 pb-2 text-sm" style={{ opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}>/month</span>
                </div>
                <p
                  className="text-xs text-slate-400 mt-0.5"
                  style={{ opacity: billingFade ? 1 : 0, transition: "opacity 0.2s ease" }}
                >
                  {billing === "annually"
                    ? <><span className="text-emerald-600 font-bold">Save 23%</span> · billed £239.88 annually</>
                    : <>&nbsp;</>}
                </p>
                <p className="text-sm text-slate-400 mt-2">For accountants & small businesses</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                <PricingFeature text="Everything in Pro" included />
                <PricingFeature text="Unlimited PDF uploads" included />
                <PricingFeature text="Multi-user access (up to 5 users)" included />
                <PricingFeature text="Bulk statement processing" included />
                <PricingFeature text="API access" included />
                <PricingFeature text="Priority email support" included />
                <PricingFeature text="Custom Excel branding" included />
                <PricingFeature text="Advanced analytics" included />
              </ul>
              <button
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                  boxShadow: "0 8px 20px rgba(108,92,231,0.30)",
                }}
              >
                Start Business
              </button>
            </div>

          </div>

          {/* FAQ link */}
          <div className="text-center py-6">
            <a
              href="#faq"
              onClick={(e) => { e.preventDefault(); document.getElementById("faq").scrollIntoView({ behavior: "smooth" }); }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              style={{ textDecoration: "none", borderBottom: "1px solid transparent", transition: "color 0.2s ease, border-color 0.2s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = "currentColor"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
            >
              Have questions? See our FAQ below ↓
            </a>
          </div>

        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6" style={{ backgroundColor: "#f8faff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 scroll-animate">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-extrabold text-slate-900">
              Everything you need to understand<br className="hidden sm:block" /> your finances
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { emoji: "📊", title: "Spending Dashboard",  desc: "Visual charts, donut graphs, and category breakdown with one-click filtering.",                      accent: "#6c5ce7", iconBg: "#f0eeff" },
              { emoji: "📥", title: "Excel Export",        desc: "Beautifully formatted 3-sheet workbook with charts, totals, and a monthly summary.",                  accent: "#00b894", iconBg: "#e6fff9" },
              { emoji: "🏷️", title: "Auto Categories",    desc: "12+ spending categories automatically applied — groceries, transport, bills, and more.",               accent: "#e17055", iconBg: "#fff2ee" },
              { emoji: "🔒", title: "Zero Storage",        desc: "Your data never touches our servers. Everything is processed in-memory and discarded immediately.",    accent: "#00cec9", iconBg: "#e6fffe" },
              { emoji: "🏦", title: "Any UK Bank",         desc: "Works with Barclays, HSBC, Lloyds, NatWest, Monzo, Starling, and more.",                             accent: "#a29bfe", iconBg: "#f3f1ff" },
              { emoji: "⚡", title: "Instant Results",     desc: "Processing takes under 10 seconds. No waiting, no queues, no sign-up required.",                      accent: "#fdcb6e", iconBg: "#fffaed" },
            ].map(({ emoji, title, desc, accent, iconBg }, idx) => (
              <div
                key={title}
                style={{
                  transitionDelay: `${idx * 0.15}s`,
                  borderLeft: `4px solid ${accent}`,
                }}
                className="feature-card anim-scale rounded-2xl p-6 bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ backgroundColor: iconBg }}>
                  {emoji}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <ReviewsSection onScrollToUpload={scrollToUpload} />

      {/* ── SECURITY ── */}
      <section id="security" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Privacy &amp; Security</p>
            <h2 className="text-4xl font-extrabold text-slate-900">Your data is safe with us</h2>
            <p className="text-lg text-slate-500 mt-4 max-w-xl mx-auto">
              StatementFlow is built with a zero-storage architecture. Your PDF never touches a database — ever.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { emoji: "🔒", title: "Zero Storage",        desc: "Your PDF is processed entirely in-memory. Nothing is written to disk, stored in a database, or retained after processing.",  accent: "#6c5ce7", iconBg: "#f0eeff" },
              { emoji: "🗑️", title: "Instantly Discarded", desc: "As soon as your transactions are extracted, your file and all associated data are discarded immediately from memory.",           accent: "#00b894", iconBg: "#e6fff9" },
              { emoji: "🛡️", title: "Never Shared",        desc: "We never see, log, or share your financial information. No analytics tools or third parties receive your statement data.",     accent: "#0984e3", iconBg: "#e8f4ff" },
            ].map(({ emoji, title, desc, accent, iconBg }, idx) => (
              <div
                key={title}
                style={{ transitionDelay: `${idx * 0.15}s`, borderLeft: `4px solid ${accent}` }}
                className="anim-scale rounded-2xl p-6 bg-white border border-slate-200 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ backgroundColor: iconBg }}>
                  {emoji}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UPLOAD SECTION ── */}
      <section ref={uploadRef} id="get-started" className="py-24 px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center">

          {/* Title + subtitle — slide up */}
          <div className="scroll-animate">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Get Started</p>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Ready to get started?</h2>
            <p className="text-slate-500 mb-10">
              Drop your PDF below. No sign-up, no credit card, no data stored — ever.
            </p>
          </div>

          {/* Upload zone — fades in 0.2s after title */}
          <div className="flex justify-center scroll-animate" style={{ transitionDelay: "0.2s" }}>
            <UploadZone onFile={handleFile} loading={loading} apiDone={apiDone} onAnimationDone={handleAnimationDone} />
          </div>

          {error && (
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

          {/* Mini trust badges — staggered pop-in */}
          <div ref={uploadBadgesRef} className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
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
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d={d} clipRule="evenodd" />
                </svg>
                {label}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" aria-label="Frequently Asked Questions" className="pt-24 pb-16 px-6 bg-slate-50">
        <div className="max-w-2xl mx-auto">

          {/* Title — slide up */}
          <div className="text-center mb-12 scroll-animate">
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-4xl font-extrabold text-slate-900">Frequently Asked Questions</h2>
          </div>

          {/* Accordion — items slide in from left one by one */}
          <div ref={faqRef} className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200 bg-white shadow-sm">
            {FAQS.map(({ q, a }, i) => (
              <div
                key={i}
                style={{
                  opacity:    faqVisible ? 1 : 0,
                  transform:  faqVisible ? "translateX(0)" : "translateX(-30px)",
                  transition: `opacity 0.5s ease-out ${i * 0.1}s, transform 0.5s ease-out ${i * 0.1}s`,
                }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-800">{q}</span>
                  <span
                    className="shrink-0 w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 text-base font-light transition-transform duration-200 select-none"
                    style={{ transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ backgroundColor: "#0f172a", borderTop: "1px solid #1e293b" }} className="px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

            {/* Left – brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <LogoIcon size={36} />
                <span className="text-white font-bold text-lg">StatementFlow</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                Turn any bank statement into instant insights.
              </p>
            </div>

            {/* Middle – quick links */}
            <div className="md:flex md:justify-center">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Quick Links</p>
                <ul className="space-y-2.5">
                  {[
                    { label: "How it works", href: "#how-it-works" },
                    { label: "Pricing",      href: "#pricing" },
                    { label: "Security",     href: "#security" },
                    { label: "FAQ",          href: "#faq" },
                  ].map(({ label, href }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
                        style={{ textDecoration: "none" }}
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right – made with love + copyright */}
            <div className="md:text-right">
              <p className="text-sm text-slate-300 font-medium mb-2">Made with ❤️ in the UK</p>
              <p className="text-xs text-slate-500">© 2026 StatementFlow. All rights reserved.</p>
            </div>

          </div>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #1e293b" }} className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Zero data retention — your privacy is protected
            </div>
            <p className="text-xs text-slate-600">Built for UK bank statements · Free to use · No account required</p>
          </div>
          {/* Hidden admin link — only visible at ?admin=true */}
          <AdminLink />
        </div>
      </footer>

    </div>
  );
}
