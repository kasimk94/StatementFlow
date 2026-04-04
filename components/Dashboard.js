"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label,
} from "recharts";

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(amount) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}
function fmtShort(amount) {
  if (Math.abs(amount) >= 1000) return "£" + (amount / 1000).toFixed(1) + "k";
  return fmt(amount);
}

// ─── Category config ──────────────────────────────────────────────────────────
const UNKNOWN_CAT = "Unknown ⚠️";

const CAT_CONFIG = {
  "Income":              { hex: "#10b981", badge: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  "Refunds":             { hex: "#14b8a6", badge: "bg-teal-100 text-teal-800 ring-teal-200" },
  "Groceries":           { hex: "#22c55e", badge: "bg-green-100 text-green-800 ring-green-200" },
  "Shopping":            { hex: "#3b82f6", badge: "bg-blue-100 text-blue-800 ring-blue-200" },
  "Fast Food":           { hex: "#f97316", badge: "bg-orange-100 text-orange-800 ring-orange-200" },
  "Eating Out":          { hex: "#f59e0b", badge: "bg-amber-100 text-amber-800 ring-amber-200" },
  "Transport":           { hex: "#0ea5e9", badge: "bg-sky-100 text-sky-800 ring-sky-200" },
  "Entertainment":       { hex: "#8b5cf6", badge: "bg-violet-100 text-violet-800 ring-violet-200" },
  "Health & Beauty":     { hex: "#ec4899", badge: "bg-pink-100 text-pink-800 ring-pink-200" },
  "Bills & Finance":     { hex: "#64748b", badge: "bg-slate-100 text-slate-700 ring-slate-200" },
  "ATM & Cash":          { hex: "#eab308", badge: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  "Charity & Donations": { hex: "#a855f7", badge: "bg-purple-100 text-purple-800 ring-purple-200" },
  "Transfers":           { hex: "#6366f1", badge: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  "Vaping & Tobacco":    { hex: "#84cc16", badge: "bg-lime-100 text-lime-800 ring-lime-200" },
  [UNKNOWN_CAT]:         { hex: "#f87171", badge: "bg-red-100 text-red-700 ring-red-200" },
};

const CAT_TIPS = {
  "Income":              "Salary, wages, benefits, and other incoming money",
  "Refunds":             "Refunds and cashbacks from retailers",
  "Groceries":           "Supermarkets, food stores, and online grocery delivery",
  "Shopping":            "Clothing, electronics, home goods, and online retail",
  "Fast Food":           "Fast food chains, cafés, and coffee shops",
  "Eating Out":          "Restaurants, pubs, and dining",
  "Transport":           "Trains, buses, taxis, Uber, and fuel",
  "Entertainment":       "Streaming, gaming, cinema, events, and hobbies",
  "Health & Beauty":     "Pharmacy, gym, haircut, and personal care",
  "Bills & Finance":     "Utilities, insurance, bank charges, and subscriptions",
  "ATM & Cash":          "ATM withdrawals and cash transactions",
  "Charity & Donations": "Charitable giving and donations",
  "Transfers":           "Bank transfers and payments to individuals",
  "Vaping & Tobacco":    "Vape shops, tobacconists, and related purchases",
  [UNKNOWN_CAT]:         "Transactions that couldn't be automatically categorised",
};

function catHex(name)   { return (CAT_CONFIG[name] ?? CAT_CONFIG[UNKNOWN_CAT]).hex; }
function catBadge(name) { return (CAT_CONFIG[name] ?? CAT_CONFIG[UNKNOWN_CAT]).badge; }

// ─── Count-up animation hook ──────────────────────────────────────────────────
function useCountUp(target, duration, triggered) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!triggered) { setValue(0); return; }
    const startTime = performance.now();
    function tick(now) {
      const t     = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else        setValue(target);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, triggered]);
  return value;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ name }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 whitespace-nowrap ${catBadge(name)}`}>
      {name}
    </span>
  );
}

// Vibrant gradient stat card
function StatCard({ label, value, sub, gradient, icon, loaded, delay, countTarget, countTriggered, countFormat }) {
  const _counted = useCountUp(
    countTarget ?? 0,
    1500,
    countTarget !== undefined ? (countTriggered ?? false) : false,
  );
  const displayValue = countTarget !== undefined
    ? (countFormat ? countFormat(_counted) : Math.round(_counted).toString())
    : value;

  return (
    <div
      className="relative rounded-2xl p-5 flex items-center gap-3 overflow-hidden"
      style={{
        background: gradient,
        borderRadius: 16,
        boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
        opacity:    loaded ? 1 : 0,
        transform:  loaded ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
      }}
    >
      {/* Decorative background circles */}
      <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-6 right-12 w-20 h-20 rounded-full bg-white/5" />

      <div className="relative w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 text-white text-2xl">
        {icon}
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">{label}</p>
        <p className="font-extrabold text-white mt-1 leading-none" style={{ fontSize: "1.6rem", whiteSpace: "nowrap" }}>{displayValue}</p>
        {sub && <p className="text-sm text-white/60 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700">{d.name}</p>
      <p style={{ color: d.payload?.fill ?? d.color }}>{fmt(d.value)}</p>
    </div>
  );
}

// Improved legend: colour dot + name + amount + percentage
function PieLegend({ data, totalExpenses }) {
  return (
    <div className="space-y-2.5 mt-5">
      {data.map((entry) => {
        const pct = totalExpenses > 0 ? ((entry.value / totalExpenses) * 100).toFixed(1) : "0.0";
        return (
          <div key={entry.name} className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
            <span style={{ fontSize: "12px", color: "#475569", flex: 1 }}>{entry.name}</span>
            <span className="text-sm font-bold text-slate-800 shrink-0">{fmtShort(entry.value)}</span>
            <span
              className="text-xs text-white font-semibold rounded-full px-1.5 py-0.5 shrink-0"
              style={{ backgroundColor: entry.fill, minWidth: "3rem", textAlign: "center" }}
            >
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }}>{fmt(p.value)}</p>
      ))}
    </div>
  );
}

const PAGE_SIZE = 15;

// ─── Main Dashboard ───────────────────────────────────────────────────────────
// ─── Export toolbar (shared between real dashboard and demo) ─────────────────
function ExportToolbar({ downloading, onDownload, onCSV, downloadError }) {
  return (
    <div
      className="export-toolbar-inner"
      style={{
        background:   "#ffffff",
        borderRadius: 14,
        border:       "1px solid #e8e4f8",
        borderLeft:   "4px solid #6c5ce7",
        boxShadow:    "0 2px 12px rgba(108,92,231,0.07), 0 1px 4px rgba(0,0,0,0.04)",
        padding:      "12px 18px 12px 20px",
      }}
    >
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Export Your Results</span>
        <span className="export-toolbar-label-sub" style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 400 }}>— download your full statement report</span>
      </div>

      {/* Buttons */}
      <div className="export-toolbar-buttons">
        <button
          onClick={onDownload}
          disabled={downloading}
          style={{
            background:  "linear-gradient(135deg, #00b894 0%, #00907a 100%)",
            color:       "#fff",
            fontWeight:  700,
            fontSize:    "0.88rem",
            padding:     "9px 20px",
            borderRadius: 11,
            border:      "none",
            cursor:      downloading ? "not-allowed" : "pointer",
            opacity:     downloading ? 0.6 : 1,
            boxShadow:   "0 4px 14px rgba(0,184,148,0.32)",
            display:     "flex",
            alignItems:  "center",
            gap:         7,
            transition:  "transform 0.15s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => { if (!downloading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,184,148,0.5)"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,184,148,0.32)"; }}
        >
          {downloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating…
            </>
          ) : (
            <><span style={{ fontSize: "1rem" }}>📊</span> Download Excel</>
          )}
        </button>

        <button
          onClick={onCSV}
          style={{
            background:   "linear-gradient(135deg, #0984e3 0%, #0652b4 100%)",
            color:        "#fff",
            fontWeight:   700,
            fontSize:     "0.88rem",
            padding:      "9px 20px",
            borderRadius: 11,
            border:       "none",
            cursor:       "pointer",
            boxShadow:    "0 4px 14px rgba(9,132,227,0.32)",
            display:      "flex",
            alignItems:   "center",
            gap:          7,
            transition:   "transform 0.15s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(9,132,227,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 14px rgba(9,132,227,0.32)"; }}
        >
          <span style={{ fontSize: "1rem" }}>📄</span> Download CSV
        </button>
      </div>

      {downloadError && (
        <div className="w-full flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {downloadError}
        </div>
      )}
    </div>
  );
}

// ─── Dev-only debug panel ─────────────────────────────────────────────────────
function DebugPanel({ debug }) {
  const [open, setOpen] = useState(false);

  const confidenceColor = {
    high:   { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
    medium: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
    low:    { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  }[debug.confidence] ?? { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: "0.8rem",
        border: "1.5px dashed #6c5ce7",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: "#1e1b4b",
          color: "#a5b4fc",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: "0.8rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <span>🛠 DEV · PARSE DEBUG</span>
        <span style={{ opacity: 0.6 }}>{open ? "▲ collapse" : "▼ expand"}</span>
      </button>

      {open && (
        <div style={{ background: "#0f0e1a", color: "#e2e8f0", padding: "14px 18px" }}>

          {/* Key metrics row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Bank",        value: debug.bank ?? "unknown" },
              { label: "Parser",      value: debug.parserUsed ?? "—" },
              { label: "Raw count",   value: debug.rawCount ?? "—" },
              { label: "Parse time",  value: `${debug.parseTimeMs ?? "—"} ms` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#1e1b4b", borderRadius: 8, padding: "6px 12px" }}>
                <div style={{ color: "#6366f1", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ color: "#e2e8f0", fontWeight: 700, marginTop: 2 }}>{value}</div>
              </div>
            ))}

            {/* Confidence badge */}
            <div style={{ background: confidenceColor.bg, border: `1px solid ${confidenceColor.border}`, borderRadius: 8, padding: "6px 12px" }}>
              <div style={{ color: "#6366f1", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence</div>
              <div style={{ color: confidenceColor.text, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>{debug.confidence ?? "—"}</div>
            </div>
          </div>

          {/* Warnings */}
          <div style={{ color: "#64748b", fontSize: "0.72rem", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Warnings ({debug.warnings?.length ?? 0})
          </div>
          {!debug.warnings?.length ? (
            <p style={{ margin: 0, color: "#10b981" }}>✓ No warnings</p>
          ) : (
            <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              {debug.warnings.map((w, i) => (
                <li key={i} style={{ color: "#fbbf24" }}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Financial Snapshot ──────────────────────────────────────────────────────
function FinancialSnapshot({ transactions, income, expenses, net, categoryBreakdown, dateRange, insights }) {
  // Category map for quick lookup
  const catMap = {};
  categoryBreakdown.forEach(c => { catMap[c.name] = c.total; });

  // Top merchant by spend
  const merchantTotals = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    merchantTotals[t.description] = (merchantTotals[t.description] || 0) + Math.abs(t.amount);
  });
  const topMerchantEntry = Object.entries(merchantTotals).sort((a, b) => b[1] - a[1])[0];
  const topMerchant = topMerchantEntry ? { name: topMerchantEntry[0], amount: topMerchantEntry[1] } : null;

  const cashTotal = (catMap["Cash"] ?? 0);
  const eatingOut = (catMap["Eating Out"] ?? 0);
  const groceries = (catMap["Groceries"] ?? 0);
  const subTotal  = insights?.subscriptions?.total ?? 0;
  const subList   = insights?.subscriptions?.list  ?? [];

  // ── Headline stat ──
  let headline = null;
  if (subTotal > 50) {
    headline = `You spend £${subTotal.toFixed(2)} every month on subscriptions alone`;
  } else if (topMerchant && expenses > 0 && topMerchant.amount / expenses > 0.3) {
    headline = `£${topMerchant.amount.toFixed(2)} of your money went to just one place — ${topMerchant.name}`;
  } else if (cashTotal > 100) {
    headline = `You withdrew £${cashTotal.toFixed(2)} cash — do you know where it went?`;
  } else if (eatingOut > groceries && groceries > 0) {
    headline = `You spent more eating out (£${eatingOut.toFixed(2)}) than on groceries (£${groceries.toFixed(2)})`;
  } else if (topMerchant) {
    headline = `Your biggest spend was £${topMerchant.amount.toFixed(2)} at ${topMerchant.name}`;
  }

  // ── Days in statement ──
  const MONTH_IDX = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  function parseDMY(s) {
    if (!s) return null;
    const m = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (m) return new Date(+m[3], MONTH_IDX[m[2]] ?? 0, +m[1]);
    return null;
  }
  const sortedDates = transactions.map(t => t.date).filter(Boolean).sort();
  let dayCount = 30;
  if (sortedDates.length >= 2) {
    const d0 = parseDMY(sortedDates[0]);
    const d1 = parseDMY(sortedDates[sortedDates.length - 1]);
    if (d0 && d1 && !isNaN(d0) && !isNaN(d1)) {
      dayCount = Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
    }
  }
  const avgPerDay = expenses / dayCount;

  // ── Biggest single purchase ──
  const biggestDebit = transactions.filter(t => t.amount < 0).sort((a, b) => a.amount - b.amount)[0];

  // ── Spending personality ──
  const SKIP_CATS = new Set(["Income","Transfers In","Transfers","Refunds","Finance & Transfers","Bank Fees"]);
  const topCat = categoryBreakdown.find(c => !SKIP_CATS.has(c.name));
  let personality = { emoji: "⚖️", name: "The Balanced Budgeter", desc: "Nice and steady spending habits" };
  if (topCat) {
    const n = topCat.name;
    if (["Groceries","Bills & Utilities","Rent & Mortgage"].includes(n)) personality = { emoji: "🏠", name: "The Homebody",          desc: "You keep it practical and grounded"     };
    else if (n === "Eating Out")    personality = { emoji: "🍕", name: "The Foodie",             desc: "You love dining out and new experiences" };
    else if (n === "Subscriptions") personality = { emoji: "📺", name: "The Streamer",            desc: "You love your digital services"          };
    else if (n === "Shopping")      personality = { emoji: "🛍️", name: "The Shopper",             desc: "Retail therapy is your thing"             };
    else if (n === "Transport")     personality = { emoji: "🚇", name: "The Commuter",            desc: "Always on the move"                       };
    else if (n === "Entertainment") personality = { emoji: "🎭", name: "The Entertainer",         desc: "Making the most of free time"             };
    else if (n === "Health & Fitness") personality = { emoji: "💪", name: "The Wellness Warrior", desc: "Investing in your health"                 };
  }

  // ── Month health ──
  const savingRate = income > 0 ? (net / income) * 100 : -1;
  let health;
  if      (savingRate >= 20) health = { label: "Excellent",       color: "#10b981", bg: "#d1fae5", pct: 100 };
  else if (savingRate >= 10) health = { label: "Good",            color: "#3b82f6", bg: "#dbeafe", pct: 70  };
  else if (savingRate >= 0)  health = { label: "Fair",            color: "#f59e0b", bg: "#fef3c7", pct: 40  };
  else                       health = { label: "Needs Attention", color: "#ef4444", bg: "#fee2e2", pct: 10  };

  // ── Biggest opportunity ──
  const biggestExpCat = categoryBreakdown.find(c => !SKIP_CATS.has(c.name));

  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", overflow: "hidden", position: "relative" }}>
      {/* Left gradient border */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "linear-gradient(180deg, #6c5ce7 0%, #00d4ff 100%)" }} />

      <div style={{ padding: "22px 22px 22px 26px" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: "0.95rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.01em" }}>
          💡 Your Money at a Glance
        </h3>

        {/* ROW 1 — Headline stat */}
        {headline && (
          <div style={{ textAlign: "center", marginBottom: 18, padding: "14px 18px", background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)", borderRadius: 12 }}>
            <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#6c5ce7", lineHeight: 1.35 }}>{headline}</p>
          </div>
        )}

        {/* ROW 2 — Three quick facts */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            { emoji: "📅", label: "Transactions", value: `${transactions.length} · ${dateRange ?? "this period"}` },
            { emoji: "💳", label: "Avg spend/day", value: fmt(avgPerDay) },
            { emoji: "🏆", label: "Biggest purchase", value: biggestDebit
                ? `${fmt(Math.abs(biggestDebit.amount))} · ${biggestDebit.description.length > 16 ? biggestDebit.description.slice(0,16)+"…" : biggestDebit.description}`
                : "—" },
          ].map(({ emoji, label, value }) => (
            <div key={label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{emoji}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.67rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ROW 3 — Personality + Health side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {/* Spending personality */}
          <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%)", border: "1px solid #e9d5ff", borderRadius: 12, padding: "14px 14px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "1.3rem" }}>{personality.emoji}</p>
            <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "0.85rem", color: "#6c5ce7" }}>{personality.name}</p>
            <p style={{ margin: 0, fontSize: "0.73rem", color: "#7c3aed" }}>{personality.desc}</p>
          </div>

          {/* Month health */}
          <div style={{ background: health.bg, borderRadius: 12, padding: "14px 14px", border: `1px solid ${health.color}44` }}>
            <p style={{ margin: "0 0 2px", fontSize: "0.67rem", fontWeight: 700, color: health.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>Month Health</p>
            <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: "0.95rem", color: health.color }}>{health.label}</p>
            <div style={{ height: 6, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${health.pct}%`, background: health.color, borderRadius: 4 }} />
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: health.color }}>
              {income > 0 ? `Saving ${Math.max(0, savingRate).toFixed(0)}% of income` : "No income recorded"}
            </p>
          </div>
        </div>

        {/* Subscription spotlight */}
        {subList.length > 0 && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "0.85rem", color: "#92400e" }}>🔄 Subscription Spotlight</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 8 }}>
              {subList.slice(0, 8).map((s, i) => (
                <span key={i} style={{ fontSize: "0.78rem", color: "#78350f" }}>• {s}</span>
              ))}
            </div>
            <div style={{ borderTop: "1px solid #fde68a", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#78350f" }}>£{subTotal.toFixed(2)}/month</span>
              <span style={{ fontSize: "0.78rem", color: "#92400e" }}>= £{(subTotal * 12).toFixed(2)}/year</span>
            </div>
          </div>
        )}

        {/* Biggest opportunity */}
        {biggestExpCat && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>💰</span>
            <p style={{ margin: 0, fontSize: "0.83rem", fontWeight: 700, color: "#15803d", lineHeight: 1.4 }}>
              If you reduced <strong>{biggestExpCat.name}</strong> by 20%, you&apos;d save <strong>{fmt(biggestExpCat.total * 0.2)}</strong> per month
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Insights Popup ────────────────────────────────────────────────────────
function InsightsPopup({ insights, onClose, totalIncome, totalExpenses }) {
  const score      = insights.spendingScore ?? 0;
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 80 ? "Excellent 🌟" : score >= 60 ? "Good 👍" : score >= 40 ? "Fair ⚠️" : "Needs Attention 🔴";
  const subTotal   = insights.subscriptions?.total ?? 0;
  const saved      = (totalIncome ?? 0) - (totalExpenses ?? 0);
  const alerts     = (insights.alerts ?? []).slice(0, 2);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 20, maxWidth: 480, width: "100%", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", position: "relative" }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e293b", margin: 0 }}>✨ Your Money Summary</h2>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: "0.9rem", color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* 1. Score Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f8fafc", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: scoreColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 3px 14px ${scoreColor}55` }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{score}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>{scoreLabel}</p>
              {insights.summary && (
                <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{insights.summary}</p>
              )}
            </div>
          </div>

          {/* 2. Three Key Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ background: "#fff1f2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 2px" }}>💰</p>
              <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.04em" }}>Spent</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "#be123c" }}>{fmt(totalExpenses ?? 0)}</p>
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 2px" }}>📈</p>
              <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: saved >= 0 ? "#166534" : "#9a3412", textTransform: "uppercase", letterSpacing: "0.04em" }}>Saved</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: saved >= 0 ? "#15803d" : "#c2410c" }}>{fmt(saved)}</p>
            </div>
            <div style={{ background: "#fffbeb", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 2px" }}>🔄</p>
              <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>Subs/mo</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "#78350f" }}>£{subTotal.toFixed(2)}</p>
            </div>
          </div>

          {/* 3. Top Insight */}
          {insights.topInsight && (
            <div style={{ background: "#ede9fe", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#4c1d95", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{insights.topInsight}</p>
            </div>
          )}

          {/* 4. Top 2 Alerts */}
          {alerts.length > 0 && alerts.map((alert, i) => (
            <div key={i} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#9a3412", lineHeight: 1.4 }}>{alert}</p>
            </div>
          ))}

          {/* 5. Savings Tip */}
          {insights.savingsOpportunity && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>💰</span>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#166534", lineHeight: 1.4 }}>
                {insights.savingsOpportunity.message}
                {insights.savingsOpportunity.potentialSaving ? ` — save ${insights.savingsOpportunity.potentialSaving}` : ""}
              </p>
            </div>
          )}

          {/* 6. CTA */}
          <button
            onClick={onClose}
            style={{ background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)", color: "#fff", fontWeight: 700, fontSize: "0.95rem", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer", marginTop: 2, boxShadow: "0 4px 20px rgba(108,92,231,0.4)" }}
          >
            View Full Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Insights Panel ────────────────────────────────────────────────────────
function InsightsPanel({ insights, totalIncome, totalExpenses }) {
  const [open, setOpen] = useState(false);
  const score      = insights.spendingScore ?? 0;
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 80 ? "Excellent 🌟" : score >= 60 ? "Good 👍" : score >= 40 ? "Fair ⚠️" : "Needs Attention 🔴";
  const subTotal   = insights.subscriptions?.total ?? 0;
  const saved      = (totalIncome ?? 0) - (totalExpenses ?? 0);
  const alerts     = (insights.alerts ?? []).slice(0, 2);

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8e4f8", borderLeft: "4px solid #6c5ce7", boxShadow: "0 2px 12px rgba(108,92,231,0.07)", overflow: "hidden" }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", padding: "14px 18px 14px 20px", background: "transparent", border: "none", cursor: "pointer", gap: 10 }}
      >
        <span style={{ fontSize: "1.1rem" }}>✨</span>
        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", flex: 1, textAlign: "left" }}>AI Insights</span>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, background: "linear-gradient(135deg, #6c5ce7, #a29bfe)", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>StatementFlow AI</span>
        <span style={{ fontSize: "0.8rem", color: "#94a3b8", marginLeft: 8 }}>{open ? "▲ Hide" : "▼ Show"} insights</span>
      </button>

      {open && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Score row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f8fafc", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: scoreColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 3px 12px ${scoreColor}44` }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "#fff" }}>{score}</span>
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>{scoreLabel}</p>
              {insights.summary && <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#64748b" }}>{insights.summary}</p>}
            </div>
          </div>

          {/* 3 key stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ background: "#fff1f2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 2px" }}>💰</p>
              <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: "#9f1239", textTransform: "uppercase" }}>Spent</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "#be123c" }}>{fmt(totalExpenses ?? 0)}</p>
            </div>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 2px" }}>📈</p>
              <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: saved >= 0 ? "#166534" : "#9a3412", textTransform: "uppercase" }}>Saved</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: saved >= 0 ? "#15803d" : "#c2410c" }}>{fmt(saved)}</p>
            </div>
            <div style={{ background: "#fffbeb", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: "0 0 2px" }}>🔄</p>
              <p style={{ margin: "0 0 2px", fontSize: "0.68rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>Subs/mo</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "#78350f" }}>£{subTotal.toFixed(2)}</p>
            </div>
          </div>

          {/* Top insight */}
          {insights.topInsight && (
            <div style={{ background: "#ede9fe", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: "0.83rem", fontWeight: 700, color: "#4c1d95", lineHeight: 1.4 }}>{insights.topInsight}</p>
            </div>
          )}

          {/* Top 2 alerts */}
          {alerts.map((alert, i) => (
            <div key={i} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#9a3412", lineHeight: 1.4 }}>{alert}</p>
            </div>
          ))}

          {/* Savings tip */}
          {insights.savingsOpportunity && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>💰</span>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#166534", lineHeight: 1.4 }}>
                {insights.savingsOpportunity.message}
                {insights.savingsOpportunity.potentialSaving ? ` — save ${insights.savingsOpportunity.potentialSaving}` : ""}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ transactions, demoMode = false, confidence, bank, debug, insights }) {
  const [search, setSearch]                   = useState("");
  const [sortKey, setSortKey]                 = useState("date");
  const [sortDir, setSortDir]                 = useState("desc");
  const [page, setPage]                       = useState(1);
  const [filterCat, setFilterCat]             = useState("All");
  const [filterType, setFilterType]           = useState("All");
  const [downloading, setDownloading]         = useState(false);
  const [downloadError, setDownloadError]     = useState(null);
  const [copied, setCopied]                   = useState(false);
  const [demoToast, setDemoToast]             = useState(false);
  const [txExpanded, setTxExpanded]           = useState(false);

  // Animation states
  const [loaded,          setLoaded]          = useState(false);
  const [barsVisible,     setBarsVisible]     = useState(false);
  const [rowsHiding,      setRowsHiding]      = useState(false);
  const [rowFadeKey,      setRowFadeKey]      = useState(0);
  const [demoTriggered,   setDemoTriggered]   = useState(false);
  const [chartsTriggered, setChartsTriggered] = useState(false);
  const [showPopup,       setShowPopup]       = useState(!demoMode && !!insights);

  useEffect(() => {
    if (!demoMode) window.scrollTo(0, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!demoMode) {
      // Real dashboard: animate immediately
      const t1 = setTimeout(() => setLoaded(true),      80);
      const t2 = setTimeout(() => setBarsVisible(true), 500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    // Demo mode: trigger all animations on mount so KPI values are
    // always calculated and visible — don't wait for IntersectionObserver
    // (the observer is unreliable on production depending on scroll position)
    const t1 = setTimeout(() => { setLoaded(true); setDemoTriggered(true); },   300);
    const t2 = setTimeout(() => { setBarsVisible(true); setChartsTriggered(true); }, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [demoMode]);

  // IntersectionObserver — scroll-triggered animations for demo mode
  const demoRef   = useRef(null);
  const chartsRef = useRef(null);
  useEffect(() => {
    if (!demoMode) return;
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (entry.target === demoRef.current) {
          setLoaded(true);
          setDemoTriggered(true);
        }
        if (entry.target === chartsRef.current) {
          setBarsVisible(true);
          setChartsTriggered(true);
        }
      }
    }, { threshold: 0.15 });
    if (demoRef.current)   obs.observe(demoRef.current);
    if (chartsRef.current) obs.observe(chartsRef.current);
    return () => obs.disconnect();
  }, [demoMode]);

  const loadedAt        = useRef(new Date());
  const rowHideTimerRef = useRef(null);

  // ── Date range ──
  const dateRange = useMemo(() => {
    const dates = transactions.map((t) => t.date).filter(Boolean).sort();
    if (!dates.length) return null;
    return dates[0] === dates[dates.length - 1]
      ? dates[0]
      : `${dates[0]} – ${dates[dates.length - 1]}`;
  }, [transactions]);

  // ── Bank name detection ──
  const bankName = useMemo(() => {
    const blob = transactions.map((t) => (t.description || "").toUpperCase()).join(" ");
    if (blob.includes("BARCLAYS"))   return "Barclays";
    if (blob.includes("HSBC"))       return "HSBC";
    if (blob.includes("LLOYDS"))     return "Lloyds";
    if (blob.includes("NATWEST"))    return "NatWest";
    if (blob.includes("SANTANDER"))  return "Santander";
    if (blob.includes("MONZO"))      return "Monzo";
    if (blob.includes("STARLING"))   return "Starling";
    if (blob.includes("HALIFAX"))    return "Halifax";
    if (blob.includes("NATIONWIDE")) return "Nationwide";
    return null;
  }, [transactions]);

  // ── Summary stats ──
  const { income, expenses, net, incomeCount, expenseCount } = useMemo(() => {
    let income = 0, expenses = 0, incomeCount = 0, expenseCount = 0;
    for (const t of transactions) {
      if (t.amount > 0) { income += t.amount; incomeCount++; }
      else { expenses += Math.abs(t.amount); expenseCount++; }
    }
    return { income, expenses, net: income - expenses, incomeCount, expenseCount };
  }, [transactions]);

  // ── Demo toast helper ──
  const showDemoToast = useCallback(() => {
    setDemoToast(true);
    setTimeout(() => setDemoToast(false), 3000);
  }, []);

  // ── Row fade-out → fade-in animation ──
  const triggerRowAnim = useCallback(() => {
    setRowsHiding(true);
    if (rowHideTimerRef.current) clearTimeout(rowHideTimerRef.current);
    rowHideTimerRef.current = setTimeout(() => {
      setRowFadeKey((k) => k + 1);
      setRowsHiding(false);
    }, 150);
  }, []);

  // ── Download Excel ──
  const handleDownload = useCallback(async () => {
    if (demoMode) { showDemoToast(); return; }
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Download failed");
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "statement.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  }, [transactions, demoMode, showDemoToast]);

  // ── Export CSV ──
  const handleCSV = useCallback(() => {
    if (demoMode) { showDemoToast(); return; }
    const header = "Date,Description,Category,Amount\n";
    const rows   = transactions
      .map((t) => [
        t.date,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        t.amount,
      ].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "statement.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [transactions, demoMode, showDemoToast]);

  // ── Share / copy summary ──
  const handleShare = useCallback(async () => {
    const lines = [
      "📊 StatementFlow Summary",
      dateRange ? `📅 ${dateRange}` : null,
      bankName  ? `🏦 ${bankName}`  : null,
      "",
      `💚 Income:        ${fmt(income)} (${incomeCount} credits)`,
      `🔴 Expenses:      ${fmt(expenses)} (${expenseCount} debits)`,
      `💙 Net balance:   ${fmt(net)}`,
      `📋 Transactions:  ${transactions.length}`,
    ].filter((l) => l !== null).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* ignore */}
  }, [income, expenses, net, incomeCount, expenseCount, transactions.length, dateRange, bankName]);

  // ── Category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      const cat = t.category || UNKNOWN_CAT;
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += Math.abs(t.amount);
      map[cat].count += 1;
    }
    const entries = Object.entries(map).map(([name, { total, count }]) => ({ name, total, count }));
    const unknown = entries.filter((e) => e.name === UNKNOWN_CAT);
    const rest    = entries.filter((e) => e.name !== UNKNOWN_CAT).sort((a, b) => b.total - a.total);
    return [...rest, ...unknown];
  }, [transactions]);

  // ── Subscription detection (merchants appearing 2+ times) ──
  const subscriptionMerchants = useMemo(() => {
    const counts = {};
    transactions.forEach(t => { counts[t.description] = (counts[t.description] || 0) + 1; });
    return new Set(Object.entries(counts).filter(([, c]) => c >= 2).map(([name]) => name));
  }, [transactions]);

  const pieData = useMemo(() =>
    categoryBreakdown.map((c) => ({ name: c.name, value: c.total, fill: catHex(c.name) })),
  [categoryBreakdown]);

  const barData = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      const key = t.description || "Unknown";
      if (!map[key]) map[key] = { expense: 0, income: 0 };
      if (t.amount < 0) map[key].expense += Math.abs(t.amount);
      else map[key].income += t.amount;
    }
    return Object.entries(map)
      .map(([name, { expense, income }]) => ({ name, expense, income }))
      .sort((a, b) => b.expense - a.expense)
      .slice(0, 8);
  }, [transactions]);

  const allCategories = ["All", ...categoryBreakdown.map((c) => c.name)];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const matchSearch =
        t.description.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q) ||
        String(Math.abs(t.amount)).includes(q) ||
        (t.category || "").toLowerCase().includes(q);
      const matchCat  = filterCat  === "All" || t.category === filterCat;
      const matchType =
        filterType === "All" ||
        (filterType === "Income"  && t.amount > 0) ||
        (filterType === "Expense" && t.amount < 0);
      return matchSearch && matchCat && matchType;
    });
  }, [transactions, search, filterCat, filterType]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "amount") { av = Number(av); bv = Number(bv); }
      if (av < bv) return sortDir === "asc" ? -1 :  1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const pageSize   = demoMode ? 10 : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function setFilter(cat) { triggerRowAnim(); setFilterCat(cat); setPage(1); }

  const loadedTime = loadedAt.current.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Fade-in helper for non-card sections
  function sectionStyle(delay) {
    return {
      opacity:    loaded ? 1 : 0,
      transform:  loaded ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
    };
  }

  return (
    <div className="space-y-6">

      {/* ── AI PARSER NOTICE ── */}
      {!demoMode && confidence === "low" && (
        <div
          style={{
            background: "linear-gradient(135deg, #fef9c3 0%, #fef3c7 100%)",
            border: "1px solid #fbbf24",
            borderRadius: 14,
            padding: "14px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span style={{ fontSize: "1.3rem", lineHeight: 1.3 }}>🤖</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: "#92400e", fontSize: "0.95rem" }}>
              AI-assisted parsing used
            </p>
            <p style={{ margin: "2px 0 0", color: "#a16207", fontSize: "0.85rem" }}>
              Your bank wasn&apos;t automatically recognised, so Claude AI was used to extract
              transactions. Please review the results and correct any errors before exporting.
            </p>
          </div>
        </div>
      )}

      {/* ── DEMO TOAST ── */}
      {demoToast && (
        <div
          style={{
            position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, background: "#1e293b", color: "#fff",
            padding: "12px 24px", borderRadius: 12, fontSize: "0.9rem", fontWeight: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", gap: 10,
            animation: "fadeSlideUp 0.3s ease forwards",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>🔒</span>
          Upload your own statement to export your data!
        </div>
      )}

      {/* ── AI INSIGHTS POPUP ── */}
      {showPopup && insights && (
        <InsightsPopup insights={insights} onClose={() => setShowPopup(false)} totalIncome={income} totalExpenses={expenses} />
      )}

      {/* ── EXPORT TOOLBAR (above KPI cards — both real and demo) ── */}
      <ExportToolbar downloading={downloading} onDownload={handleDownload} onCSV={handleCSV} downloadError={downloadError} />

      {/* ── AI INSIGHTS PANEL ── */}
      {!demoMode && insights && (
        <InsightsPanel insights={insights} totalIncome={income} totalExpenses={expenses} />
      )}

      {/* ── FINANCIAL SNAPSHOT ── */}
      {!demoMode && transactions.length > 0 && (
        <FinancialSnapshot
          transactions={transactions}
          income={income}
          expenses={expenses}
          net={net}
          categoryBreakdown={categoryBreakdown}
          dateRange={dateRange}
          insights={insights}
        />
      )}

      {/* ── STAT CARDS ── */}
      <div ref={demoRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Money In"
          value={fmt(income)}
          sub={`${incomeCount} credit${incomeCount !== 1 ? "s" : ""}`}
          gradient="linear-gradient(135deg, #00b894 0%, #00cec9 100%)"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>}
          loaded={loaded}
          delay={100}
          countTarget={demoMode ? income : undefined}
          countTriggered={demoTriggered}
          countFormat={(v) => fmt(v)}
        />
        <StatCard
          label="Total Money Out"
          value={fmt(expenses)}
          sub={`${expenseCount} debit${expenseCount !== 1 ? "s" : ""}`}
          gradient="linear-gradient(135deg, #e17055 0%, #d63031 100%)"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>}
          loaded={loaded}
          delay={200}
          countTarget={demoMode ? expenses : undefined}
          countTriggered={demoTriggered}
          countFormat={(v) => fmt(v)}
        />
        <StatCard
          label="Net Balance"
          value={fmt(net)}
          sub={net >= 0 ? "✓ Positive cash flow" : "⚠ Negative cash flow"}
          gradient={net >= 0
            ? "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)"
            : "linear-gradient(135deg, #d63031 0%, #e17055 100%)"}
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          loaded={loaded}
          delay={300}
          countTarget={demoMode ? Math.abs(net) : undefined}
          countTriggered={demoTriggered}
          countFormat={(v) => fmt(net >= 0 ? v : -v)}
        />
        <StatCard
          label="Transactions"
          value={`${transactions.length}`}
          sub={`${incomeCount} in · ${expenseCount} out`}
          gradient="linear-gradient(135deg, #fd79a8 0%, #e84393 100%)"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          loaded={loaded}
          delay={400}
          countTarget={demoMode ? transactions.length : undefined}
          countTriggered={demoTriggered}
          countFormat={(v) => Math.round(v).toString()}
        />
      </div>

      {/* ── CHARTS ── */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={sectionStyle(350)}>

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" style={{ borderRadius: 16 }}>
          <h3 className="text-lg font-bold text-slate-800">Spending Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Expenses by category</p>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No expense data</div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              {/* Chart */}
              <div className="w-full lg:w-56 shrink-0" style={{ overflow: "visible", padding: "0 8px" }}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                      isAnimationActive={true}
                      animationDuration={900}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          const cx = viewBox?.cx ?? 0;
                          const cy = viewBox?.cy ?? 0;
                          if (!cx || !cy) return null;
                          return (
                            <g>
                              <text x={cx} y={cy - 8} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="inherit">Net</text>
                              <text
                                x={cx} y={cy + 10}
                                textAnchor="middle"
                                fill={net >= 0 ? "#10b981" : "#ef4444"}
                                fontSize={13}
                                fontWeight="bold"
                                fontFamily="inherit"
                              >
                                {fmtShort(net)}
                              </text>
                            </g>
                          );
                        }}
                        position="center"
                      />
                    </Pie>
                    <ReTooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex-1">
                <PieLegend data={pieData} totalExpenses={expenses} />
              </div>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" style={{ borderRadius: 16 }}>
          <h3 className="text-lg font-bold text-slate-800">Top Merchants</h3>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Top 8 by total spend</p>
          {barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category" dataKey="name" width={110}
                  tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                />
                <ReTooltip content={<BarTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="expense" name="Expense" fill="#e17055" radius={[0, 6, 6, 0]} maxBarSize={16} isAnimationActive={demoMode ? chartsTriggered : true} animationDuration={800} />
                <Bar dataKey="income"  name="Income"  fill="#00b894" radius={[0, 6, 6, 0]} maxBarSize={16} isAnimationActive={demoMode ? chartsTriggered : true} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── CATEGORY BREAKDOWN ── */}
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
        style={{ ...sectionStyle(450), borderRadius: 16 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Spending by Category</h3>
            <p className="text-xs text-slate-400 mt-0.5">Click a category to filter the transaction table</p>
          </div>
          {filterCat !== "All" && (
            <button
              onClick={() => setFilter("All")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              ✕ Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryBreakdown.map(({ name, total, count }, idx) => {
            const hex      = catHex(name);
            const pct      = expenses > 0 ? (total / expenses) * 100 : 0;
            const isActive = filterCat === name;
            const tip      = CAT_TIPS[name] ?? "Transactions in this category";

            return (
              <button
                key={name}
                onClick={() => setFilter(isActive ? "All" : name)}
                className={`group relative text-left p-4 rounded-xl border transition-all hover:shadow-md ${
                  isActive
                    ? "border-blue-400 ring-2 ring-blue-200 bg-blue-50/50"
                    : "border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200"
                }`}
                style={{ borderRadius: 12 }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                  style={{ backgroundColor: hex }}
                />

                <div className="pl-3">
                  {/* Top row: name + tooltip + pct badge */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                      <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Tooltip */}
                      <div className="relative">
                        <span
                          className="text-slate-300 hover:text-slate-500 text-xs cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >ℹ</span>
                        <div
                          className="pointer-events-none absolute z-20 bottom-full right-0 mb-2 w-48 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          style={{ transform: "translateX(20%)" }}
                        >
                          {tip}
                          <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                        </div>
                      </div>
                      <span
                        className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: hex, minWidth: "2.8rem", textAlign: "center" }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Amount + count */}
                  <p className="text-xl font-extrabold text-slate-800 leading-none mb-2">{fmt(total)}</p>
                  <p className="text-xs text-slate-400 mb-2.5">{count} transaction{count !== 1 ? "s" : ""}</p>

                  {/* Progress bar */}
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width:           barsVisible ? `${Math.min(pct, 100)}%` : "0%",
                        backgroundColor: hex,
                        transition:      `width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 55}ms`,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TRANSACTIONS TABLE ── */}
      <div style={sectionStyle(550)}>
        {/* Collapse toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: txExpanded ? 12 : 0 }}>
          <button
            onClick={() => setTxExpanded(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: txExpanded ? "linear-gradient(135deg,#6c5ce7,#a29bfe)" : "#f8fafc",
              color: txExpanded ? "#fff" : "#1e293b",
              fontWeight: 700, fontSize: "0.95rem",
              padding: "11px 20px", borderRadius: 12, border: "1px solid #e2e8f0",
              cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: txExpanded ? "0 4px 14px rgba(108,92,231,0.3)" : "none",
            }}
          >
            <span>{txExpanded ? "▲" : "📋"}</span>
            <span>{txExpanded ? "Hide Transactions" : `View Transactions (${transactions.length})`}</span>
          </button>
          {!txExpanded && (
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Full list available in your Excel export</span>
          )}
        </div>

      <div
        style={{
          maxHeight: txExpanded ? "9999px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.4s ease",
        }}
      >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
        style={{ borderRadius: 16 }}
      >
        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Transactions
              {filterCat !== "All" && (
                <span className="ml-2 text-sm font-normal text-slate-400">· filtered by {filterCat}</span>
              )}
            </h3>
            <p className="text-xs text-slate-400">{sorted.length} result{sorted.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search transactions…"
                value={search}
                onChange={(e) => { const v = e.target.value; triggerRowAnim(); setSearch(v); setPage(1); }}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-44 sm:w-52 bg-slate-50"
              />
            </div>
            {/* Category filter */}
            <select
              value={filterCat}
              onChange={(e) => { const v = e.target.value; triggerRowAnim(); setFilterCat(v); setPage(1); }}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-700"
            >
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Type filter */}
            <select
              value={filterType}
              onChange={(e) => { const v = e.target.value; triggerRowAnim(); setFilterType(v); setPage(1); }}
              className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-700"
            >
              <option value="All">All types</option>
              <option value="Income">Income only</option>
              <option value="Expense">Expenses only</option>
            </select>
          </div>
        </div>

        {/* Table with sticky header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-3.5 text-left font-bold cursor-pointer hover:text-slate-700 select-none whitespace-nowrap" onClick={() => toggleSort("date")}>
                  Date <SortIcon col="date" />
                </th>
                <th className="px-5 py-3.5 text-left font-bold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("description")}>
                  Description <SortIcon col="description" />
                </th>
                <th className="px-5 py-3.5 text-left font-bold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("category")}>
                  Category <SortIcon col="category" />
                </th>
                <th className="px-5 py-3.5 text-right font-bold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("amount")}>
                  Amount <SortIcon col="amount" />
                </th>
              </tr>
            </thead>
            <tbody style={{ opacity: rowsHiding ? 0 : 1, transition: "opacity 0.15s ease" }}>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">🔍</span>
                      <p className="font-medium">No transactions match your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((t, i) => {
                  const isIncome = t.amount >= 0;
                  const rowBg    = i % 2 === 0 ? "bg-white" : "bg-slate-50/50";
                  const hex      = catHex(t.category || UNKNOWN_CAT);
                  return (
                    <tr
                      key={`${rowFadeKey}-${i}`}
                      className={`${rowBg} hover:bg-blue-50/40 transition-colors`}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        animation: `rowFadeIn 0.3s ease forwards ${Math.min(i, 14) * 30}ms`,
                        opacity: 0,
                      }}
                    >
                      {/* Date cell with coloured left border */}
                      <td
                        className="py-3.5 text-slate-500 whitespace-nowrap font-mono text-xs"
                        style={{
                          paddingLeft:  "1.25rem",
                          paddingRight: "1.25rem",
                          borderLeft:   `3px solid ${hex}`,
                        }}
                      >
                        {t.date}
                      </td>
                      {/* Description with coloured category dot */}
                      <td className="px-5 py-3.5 text-slate-700 max-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                          <span className="truncate block">{t.description}</span>
                          {subscriptionMerchants.has(t.description) && (
                            <span title="Recurring transaction" style={{ fontSize: "0.7rem", flexShrink: 0, opacity: 0.75 }}>🔄</span>
                          )}
                        </div>
                      </td>
                      {/* Category badge */}
                      <td className="px-5 py-3.5">
                        <CategoryBadge name={t.category || UNKNOWN_CAT} />
                      </td>
                      {/* Amount */}
                      <td className={`px-5 py-3.5 text-right font-bold whitespace-nowrap text-base ${isIncome ? "text-emerald-600" : "text-red-500"}`}>
                        {isIncome ? "+" : ""}{fmt(t.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50/60">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                let p;
                if (totalPages <= 5)             p = idx + 1;
                else if (page <= 3)              p = idx + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + idx;
                else                             p = page - 2 + idx;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                      p === page
                        ? "text-white border-transparent"
                        : "border-slate-200 hover:bg-white text-slate-600"
                    }`}
                    style={p === page ? { background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)" } : {}}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      </div>{/* end max-height wrapper */}
      </div>{/* end transactions outer */}

      {/* ── DEV DEBUG PANEL ── */}
      {process.env.NODE_ENV === "development" && !demoMode && debug && (
        <DebugPanel debug={debug} />
      )}

    </div>
  );
}
