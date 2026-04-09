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


  const PRO_MONTHLY = 5.99;
  const BIZ_MONTHLY = 25.99;
  const PRO_ANNUAL  = 3.99;
  const BIZ_ANNUAL  = 17.99;

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
      setAnimState("out");
      setTimeout(() => {
        setWordIndex(i => (i + 1) % CYCLING_WORDS.length);
        setAnimState("in");
      }, 500); // matches wordOut duration
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
    <div className="min-h-screen bg-white">

      <Navbar onScrollToUpload={scrollToUpload} showReviewsLink={hasReviews} />

      {/* ── SEO ── */}
      <p className="visually-hidden">StatementFlow is a free UK bank statement converter that transforms PDF bank statements into Excel reports and spending dashboards. Supporting all major UK banks including Barclays, HSBC, Lloyds, NatWest, Santander, Monzo and Starling.</p>

      {/* ══ SECTION 1: HERO ══ */}
      <section id="hero" className="pt-28 pb-20 px-6 text-center" style={{ background: "linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 scroll-animate" style={{ background: "#f3f0ff", border: "1px solid #ddd6fe", color: "#6d28d9" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6d28d9", display: "inline-block" }} />
            Free · No account required · Instant results
          </div>
          <h1 className="font-extrabold text-slate-900 leading-tight tracking-tight mb-6 scroll-animate" style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)", transitionDelay: "0.05s" }}>
            Your Bank Statement.<br />Finally Working For You.
          </h1>
          <p className="text-slate-500 mx-auto mb-10 scroll-animate" style={{ fontSize: "1.15rem", lineHeight: 1.75, maxWidth: 600, transitionDelay: "0.1s" }}>
            Upload any UK bank statement and instantly turn it into a spending dashboard, budget tracker, or accountant-ready Excel report — in seconds. No bank login. No data stored. No nonsense.
          </p>
          <div className="hero-cta-group mb-10 scroll-animate" style={{ transitionDelay: "0.15s" }}>
            <button onClick={scrollToUpload} style={{ background: "linear-gradient(135deg, #6d28d9, #4f46e5)", color: "white", fontWeight: 700, fontSize: "1rem", padding: "14px 32px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(109,40,217,0.35)", minHeight: 52 }}>
              Convert My Statement →
            </button>
            <button onClick={() => { const el = document.getElementById("how-it-works"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} style={{ fontWeight: 600, fontSize: "1rem", padding: "14px 32px", borderRadius: 999, border: "2px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer", minHeight: 52 }}>
              See How It Works
            </button>
          </div>
          <div ref={badgesRef} className="hero-trust-bar" style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
            {["🔒 No data stored", "🇬🇧 Built for UK banks", "⚡ Results in seconds", "✓ No account needed"].map((t, i) => (
              <span key={t} style={{ opacity: badgesVisible ? 1 : 0, transition: `opacity 0.4s ease ${i * 0.1}s` }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SECTION 2: PROBLEM ══ */}
      <section className="hp-section" style={{ background: "#f9fafb" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <p className="scroll-animate" style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6d28d9", textTransform: "uppercase", marginBottom: 16 }}>Sound Familiar?</p>
          <h2 className="scroll-animate text-slate-900 font-extrabold" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", lineHeight: 1.25, marginBottom: 56, transitionDelay: "0.05s" }}>
            Your money is a mystery.<br />It doesn&apos;t have to be.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 32, textAlign: "left" }}>
            {[
              { icon: "😤", heading: '"Where did my money go this month?"', body: "You check your balance and it's lower than expected. You scroll through transactions and still have no idea." },
              { icon: "📊", heading: '"Copy-pasting statements takes hours."', body: "If you're an accountant or business owner, you know the pain of manually cleaning bank data for every client." },
              { icon: "🔗", heading: '"Open Banking feels risky."', body: "You shouldn't need to hand over your login details just to understand your own finances." },
            ].map(({ icon, heading, body }, i) => (
              <div key={i} className="scroll-animate" style={{ display: "flex", gap: 20, alignItems: "flex-start", transitionDelay: `${i * 0.1}s` }}>
                <span style={{ fontSize: "2rem", flexShrink: 0, lineHeight: 1 }}>{icon}</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b", margin: "0 0 6px" }}>{heading}</p>
                  <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="scroll-animate" style={{ marginTop: 48, fontWeight: 800, fontSize: "1.2rem", color: "#6d28d9" }}>There&apos;s a better way.</p>
        </div>
      </section>

      {/* ══ SECTION 3: HOW IT WORKS ══ */}
      <section id="how-it-works" className="hp-section" style={{ background: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6d28d9", textTransform: "uppercase", marginBottom: 12 }}>How It Works</p>
            <h2 className="font-extrabold text-slate-900" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>Upload Once. Understand Everything.</h2>
            <p style={{ color: "#64748b", fontSize: "1rem", maxWidth: 560, margin: "0 auto" }}>StatementFlow reads your PDF bank statement and instantly structures it into something you can actually use.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, position: "relative" }}>
            {[
              { num: "01", icon: "📄", title: "Upload your PDF", desc: "Download your statement from your bank app and drop it here. We support all major UK banks including Barclays, HSBC, Lloyds, Monzo, Starling and more." },
              { num: "02", icon: "⚡", title: "We structure it instantly", desc: "Our engine reads every transaction, categorises your spending, detects patterns, and builds your complete financial picture — in seconds." },
              { num: "03", icon: "✓",  title: "You get clarity", desc: "A live spending dashboard, downloadable Excel report, and CSV — ready for budgeting, tracking, or sending straight to your accountant." },
            ].map(({ num, icon, title, desc }, i) => (
              <div key={num} className="scroll-animate" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "32px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", textAlign: "center", transitionDelay: `${i * 0.1}s`, position: "relative" }}>
                <div style={{ fontSize: "3rem", fontWeight: 900, color: "#f1f0ff", lineHeight: 1, marginBottom: 8, userSelect: "none" }}>{num}</div>
                <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #f3f0ff, #ede9fe)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", margin: "0 auto 16px" }}>{icon}</div>
                <h3 style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b", margin: "0 0 10px" }}>{title}</h3>
                <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.65, margin: 0 }}>{desc}</p>
                {i < 2 && <div style={{ position: "absolute", right: -20, top: "50%", transform: "translateY(-50%)", fontSize: "1.4rem", color: "#c4b5fd", zIndex: 2, display: "none" }} className="md:block">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SECTION 4: TWO AUDIENCES ══ */}
      <section className="hp-section" style={{ background: "#f9fafb" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6d28d9", textTransform: "uppercase", marginBottom: 12 }}>Who It&apos;s For</p>
            <h2 className="font-extrabold text-slate-900" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)" }}>Built for individuals. Trusted by accountants.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {/* Individuals card */}
            <div className="scroll-animate audience-card-pad" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", border: "1px solid #ddd6fe", borderRadius: 24 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>👤</div>
              <h3 style={{ fontWeight: 800, fontSize: "1.25rem", color: "#1e293b", margin: "0 0 6px" }}>Take control of your money</h3>
              <p style={{ color: "#6d28d9", fontWeight: 600, fontSize: "0.82rem", margin: "0 0 20px" }}>For individuals &amp; families</p>
              <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.7, margin: "0 0 24px" }}>
                Use your bank statement to finally understand where your money goes every month. Build a real budget based on actual spending — not guesses.<br /><br />
                No bank login required. No risky connections. Just upload, understand, and take back control.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Spending breakdown by category", "Monthly dashboard with insights", "Budget tracker ready to use", "Your data never stored or shared"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "#1e293b", fontSize: "0.88rem", fontWeight: 500 }}>
                    <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <button onClick={scrollToUpload} style={{ background: "linear-gradient(135deg, #6d28d9, #4f46e5)", color: "white", fontWeight: 700, padding: "12px 28px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.9rem" }}>Try Free →</button>
            </div>
            {/* Accountants card */}
            <div className="scroll-animate audience-card-pad" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)", borderRadius: 24, transitionDelay: "0.1s" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>📊</div>
              <h3 style={{ fontWeight: 800, fontSize: "1.25rem", color: "white", margin: "0 0 6px" }}>Turn statements into structured data</h3>
              <p style={{ color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: "0.82rem", margin: "0 0 20px" }}>For accountants, bookkeepers &amp; businesses</p>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", lineHeight: 1.7, margin: "0 0 24px" }}>
                Stop copying and pasting. Upload any client bank statement and get a clean, structured Excel or CSV instantly — ready for reconciliation, VAT analysis, and reporting.<br /><br />
                No manual cleanup. No formatting headaches. Just accurate data, exactly how you need it.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Debit & credit split columns", "Tax category mapping", "VAT estimation built in", "Audit-ready reconciliation view"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.9)", fontSize: "0.88rem", fontWeight: 500 }}>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>✓</span> {t}
                  </li>
                ))}
              </ul>
              <button onClick={() => { const el = document.getElementById("how-it-works"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} style={{ background: "white", color: "#1e3a5f", fontWeight: 700, padding: "12px 28px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: "0.9rem" }}>See Business Features →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 5: BEFORE / AFTER ══ */}
      <section className="hp-section" style={{ background: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 56 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6d28d9", textTransform: "uppercase", marginBottom: 12 }}>The Transformation</p>
            <h2 className="font-extrabold text-slate-900" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>From messy PDF to complete clarity</h2>
            <p style={{ color: "#64748b", fontSize: "1rem" }}>This is what happens the moment you upload.</p>
          </div>
          <div className="before-after-grid">
            {/* Before panel */}
            <div className="scroll-animate" style={{ border: "2px solid #fecaca", borderRadius: 20, overflow: "hidden" }}>
              <div style={{ background: "#fef2f2", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>YOUR PDF STATEMENT</span>
              </div>
              <div style={{ padding: "20px 20px 16px", background: "#fafafa" }}>
                {[["03 Mar 2024","FPS OUT JOHN SMITH REF SN2024..","450.00"],["04 Mar 2024","CARD PAYMENT TO AMZNMKTPLACE*YH7G2...","23.99"],["04 Mar 2024","DD BARCLAYS PRTNR FIN SRV...","237.38"],["05 Mar 2024","FASTER PAYMENTS REC'D 004523...","1200.00"],["06 Mar 2024","CARD PAYMENT TO PAYPAL *PENNYAP...","10.00"]].map(([d,t,a],i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px", gap: 8, padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.72rem", color: "#94a3b8", filter: i > 1 ? "blur(2px)" : "none", opacity: i > 2 ? 0.4 : 1 }}>
                    <span style={{ whiteSpace: "nowrap" }}>{d}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
                    <span style={{ textAlign: "right" }}>{a}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: "0.65rem", color: "#cbd5e1", fontStyle: "italic" }}>...47 more rows</div>
              </div>
              <p style={{ textAlign: "center", padding: "12px", color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic", background: "#fafafa" }}>A PDF only a bank could love</p>
            </div>
            {/* Arrow */}
            <div className="before-after-arrow-h" style={{ fontSize: "2.5rem", color: "#6d28d9", fontWeight: 900, textAlign: "center" }}>→</div>
            <div className="before-after-arrow-v">↓</div>
            {/* After panel */}
            <div className="scroll-animate" style={{ border: "2px solid #bbf7d0", borderRadius: 20, overflow: "hidden", transitionDelay: "0.1s" }}>
              <div style={{ background: "#f0fdf4", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#dcfce7", color: "#166534", fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>YOUR STATEMENTFLOW DASHBOARD</span>
              </div>
              <div style={{ padding: "16px 20px", background: "white" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[{l:"Money In",v:"£3,240",c:"#00b894"},{l:"Money Out",v:"£1,890",c:"#dc2626"},{l:"Net Balance",v:"£1,350",c:"#6d28d9"},{l:"Transactions",v:"52",c:"#64748b"}].map(({l,v,c}) => (
                    <div key={l} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${c}` }}>
                      <p style={{ margin: 0, fontSize: "0.65rem", color: "#94a3b8", fontWeight: 600 }}>{l}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "1rem", fontWeight: 800, color: c }}>{v}</p>
                    </div>
                  ))}
                </div>
                {[{d:"03 Mar","m":"John Smith","c":"Transfers Sent","a":"£450","cc":"#dc2626","pill":"#dc2626"},{d:"04 Mar","m":"Amazon Marketplace","c":"Online Shopping","a":"£23.99","cc":"#ca8a04","pill":"#ca8a04"},{d:"04 Mar","m":"Barclays Partner Finance","c":"Direct Debits","a":"£237.38","cc":"#4f46e5","pill":"#4f46e5"}].map(({d,m,c,a,cc,pill},i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{d}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 600, color: "#1e293b" }}>{m}</p>
                      <span style={{ background: `${pill}20`, color: pill, fontSize: "0.62rem", fontWeight: 700, padding: "1px 6px", borderRadius: 999 }}>{c}</span>
                    </div>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: cc }}>{a}</span>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: "center", padding: "12px", color: "#94a3b8", fontSize: "0.78rem", fontStyle: "italic", background: "white", borderTop: "1px solid #f1f5f9" }}>Clarity in seconds</p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <p style={{ color: "#64748b", fontSize: "1rem", marginBottom: 20 }}>Join people across the UK who&apos;ve stopped guessing and started knowing.</p>
            <button onClick={scrollToUpload} style={{ background: "linear-gradient(135deg, #6d28d9, #4f46e5)", color: "white", fontWeight: 700, fontSize: "1rem", padding: "14px 36px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(109,40,217,0.3)" }}>
              Convert My Statement Free →
            </button>
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
                  Save up to 33%
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
                <p className="text-sm text-slate-400 mt-2">Perfect for getting started</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                <PricingFeature text="3 PDF uploads per month" included />
                <PricingFeature text="Spending dashboard" included />
                <PricingFeature text="Basic categories" included />
                <PricingFeature text="CSV export" included />
                <PricingFeature text="Excel export" included={false} />
                <PricingFeature text="Accountant view" included={false} />
                <PricingFeature text="VAT estimation" included={false} />
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
                    ? <><span className="text-emerald-300 font-bold">Save 33%</span> · billed £47.88 annually</>
                    : <>&nbsp;</>}
                </p>
                <p className="text-sm text-white/60 mt-2">For individuals who want full control</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                <PricingFeature text="Unlimited PDF uploads" included light />
                <PricingFeature text="Full spending dashboard" included light />
                <PricingFeature text="Advanced categories & insights" included light />
                <PricingFeature text="Excel & CSV export" included light />
                <PricingFeature text="Spending personality & AI insights" included light />
                <PricingFeature text="Priority processing" included light />
                <PricingFeature text="Accountant view" included={false} light />
                <PricingFeature text="VAT estimation" included={false} light />
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
                    ? <><span className="text-emerald-600 font-bold">Save 31%</span> · billed £215.88 annually</>
                    : <>&nbsp;</>}
                </p>
                <p className="text-sm text-slate-400 mt-2">For accountants &amp; small businesses</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                <PricingFeature text="Everything in Pro" included />
                <PricingFeature text="Accountant P&L view" included />
                <PricingFeature text="VAT estimation built in" included />
                <PricingFeature text="Audit-ready reconciliation" included />
                <PricingFeature text="Professional PDF reports" included />
                <PricingFeature text="Debit & credit split export" included />
                <PricingFeature text="Tax category mapping" included />
                <PricingFeature text="Priority support" included />
              </ul>
              <button
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                  boxShadow: "0 8px 20px rgba(30,58,95,0.35)",
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

      {/* ══ SECTION 6: SOCIAL PROOF BAR ══ */}
      <section style={{ background: "#f5f3ff", borderTop: "1px solid #ede9fe", borderBottom: "1px solid #ede9fe", padding: "22px 24px" }}>
        <div className="social-proof-bar" style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#4c1d95", fontSize: "0.95rem" }}>Trusted by individuals and accountants across the UK</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            {["All major UK banks supported", "Free forever · No signup", "PDF to Excel in seconds"].map((t, i) => (
              <span key={i} style={{ fontSize: "0.8rem", color: "#7c3aed", fontWeight: 600 }}>· {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section id="security" className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 scroll-animate">
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6d28d9", textTransform: "uppercase", marginBottom: 12 }}>Security &amp; Privacy</p>
            <h2 className="text-4xl font-extrabold text-slate-900">Built on Zero-Knowledge Architecture</h2>
            <p className="text-lg text-slate-500 mt-4 max-w-xl mx-auto">
              Your financial data never leaves your device. We process everything in-memory and delete it instantly.
            </p>
          </div>

          {/* Trust Seal */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", border: "2px solid #6d28d9", borderRadius: 16, padding: "24px 32px", background: "linear-gradient(135deg, #fafafa, #f3f0ff)", boxShadow: "0 4px 24px rgba(109,40,217,0.08)", maxWidth: 280 }}>
              <div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #6d28d9, #4f46e5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 24 }}>🔒</div>
              <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e1e2e", margin: "0 0 4px 0", textAlign: "center" }}>Zero-Knowledge Architecture</p>
              <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0 0 12px 0", textAlign: "center" }}>Verified Privacy Standard</p>
              <div style={{ width: "100%", height: 1, background: "#e5e7eb", margin: "0 0 12px 0" }} />
              <p style={{ fontSize: "0.7rem", color: "#9ca3af", margin: 0, textAlign: "center", letterSpacing: "0.05em" }}>STATEMENTFLOW · UK</p>
            </div>
          </div>

          {/* Feature cards — 2×2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 security-grid-2col">
            {[
              { emoji: "🧠", title: "Local-First Processing",      desc: "Your PDF is processed entirely in your browser session. No data is sent to external servers for storage — ever.",                                                    accent: "#6d28d9", iconBg: "#f3f0ff" },
              { emoji: "🔑", title: "Zero-Knowledge Architecture", desc: "We never see your transactions. Our system processes data in isolated memory that is wiped the moment your session ends.",                                            accent: "#4f46e5", iconBg: "#eef2ff" },
              { emoji: "🇬🇧", title: "UK Privacy Compliant",       desc: "Built to exceed UK GDPR standards. No cookies tracking your financial behaviour, no third-party data sharing.",                                                       accent: "#0f766e", iconBg: "#f0fdfa" },
              { emoji: "✓",  title: "No Account Required",        desc: "We don't collect your name, email, or any personal information. Upload, analyse, download, done.",                                                                    accent: "#16a34a", iconBg: "#f0fdf4" },
            ].map(({ emoji, title, desc, accent, iconBg }, idx) => (
              <div
                key={title}
                style={{ transitionDelay: `${idx * 0.1}s`, borderLeft: `4px solid ${accent}` }}
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

      {/* ══ SECTION 7: COMPARISON TABLE ══ */}
      <section className="hp-section" style={{ background: "#f9fafb" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div className="text-center scroll-animate" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", color: "#6d28d9", textTransform: "uppercase", marginBottom: 12 }}>Why StatementFlow</p>
            <h2 className="font-extrabold text-slate-900" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)", marginBottom: 12 }}>The smarter way to handle your statement</h2>
            <p style={{ color: "#64748b", fontSize: "1rem" }}>See how we compare to the alternatives.</p>
          </div>
          <p className="comparison-table-hint">← Scroll to see more →</p>
          <div className="scroll-animate comparison-table-wrap" style={{ transitionDelay: "0.05s" }}>
            <table className="comparison-table" style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
              <thead>
                <tr>
                  <th style={{ background: "#f8fafc", padding: "14px 20px", textAlign: "left", fontSize: "0.8rem", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Feature</th>
                  <th style={{ background: "linear-gradient(135deg, #6d28d9, #4f46e5)", padding: "14px 20px", textAlign: "center", fontSize: "0.8rem", fontWeight: 700, color: "white", borderBottom: "1px solid #4f46e5" }}>StatementFlow</th>
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
                    <td style={{ padding: "13px 20px", fontSize: "0.88rem", fontWeight: 500, color: "#1e293b", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>{feature}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "1.1rem", background: i % 2 === 0 ? "#faf8ff" : "#f5f0ff", borderBottom: i < arr.length - 1 ? "1px solid #ede9fe" : "none" }}>{sf}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "1.1rem", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>{mc}</td>
                    <td style={{ padding: "13px 20px", textAlign: "center", fontSize: "1.1rem", borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>{ob}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.75rem", color: "#94a3b8" }}>⚠️ = partial support or varies by provider</p>
          </div>
        </div>
      </section>

      {/* ── UPLOAD SECTION ── hidden until CTA clicked ── */}
      <section
        ref={uploadRef}
        id="get-started"
        className="px-6 bg-white"
        style={{
          overflow:   "hidden",
          maxHeight:  uploadVisible ? "900px" : "0",
          transition: uploadVisible ? "max-height 0.6s ease" : "none",
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

          {/* Title + subtitle */}
          <p className="text-blue-600 font-semibold text-sm uppercase tracking-widest mb-3">Get Started</p>
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Ready to get started?</h2>
          <p className="text-slate-500 mb-10">
            Drop your PDF below. No sign-up, no credit card, no data stored — ever.
          </p>

          {/* Upload zone */}
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

      {/* ══ SECTION 8: FINAL CTA ══ */}
      <section className="hp-section" style={{ background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #4f46e5 100%)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 className="font-extrabold scroll-animate final-cta-headline" style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", color: "white", lineHeight: 1.2, marginBottom: 20 }}>
            Your bank statement is trying<br />to tell you something.
          </h2>
          <p className="scroll-animate" style={{ color: "rgba(255,255,255,0.72)", fontSize: "1.1rem", lineHeight: 1.75, marginBottom: 40, transitionDelay: "0.05s" }}>
            Every month you pay for things you&apos;ve forgotten. Every month you wonder where it all went. StatementFlow gives you the answer in seconds — completely free.
          </p>
          <div className="hero-cta-group scroll-animate" style={{ transitionDelay: "0.1s" }}>
            <button onClick={scrollToUpload} style={{ background: "white", color: "#6d28d9", fontWeight: 800, fontSize: "1rem", padding: "16px 36px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 8px 32px rgba(0,0,0,0.25)", minHeight: 52 }}>
              Convert My Statement Free →
            </button>
            <button
              onClick={() => { const el = document.getElementById("how-it-works"); if (el) el.scrollIntoView({ behavior: "smooth" }); }}
              style={{ fontWeight: 600, fontSize: "1rem", padding: "16px 32px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.08)", color: "white", cursor: "pointer", minHeight: 52 }}
            >
              See How It Works
            </button>
          </div>
          <p className="scroll-animate" style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.8rem", marginTop: 28, transitionDelay: "0.15s" }}>
            Free forever · No account · No bank login · No data stored
          </p>
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
            <div className="md:text-right footer-col-right">
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
