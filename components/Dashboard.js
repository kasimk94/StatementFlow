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
  "Groceries":               { hex: "#166534", badge: "bg-green-100 text-green-800 ring-green-200" },
  "Eating Out":              { hex: "#9a3412", badge: "bg-orange-100 text-orange-800 ring-orange-200" },
  "Online Shopping":         { hex: "#854d0e", badge: "bg-yellow-100 text-yellow-800 ring-yellow-200" },
  "High Street":             { hex: "#9d174d", badge: "bg-pink-100 text-pink-800 ring-pink-200" },
  "Travel & Transport":      { hex: "#1e40af", badge: "bg-blue-100 text-blue-800 ring-blue-200" },
  "Household Bills":         { hex: "#334155", badge: "bg-slate-100 text-slate-700 ring-slate-200" },
  "Direct Debits":           { hex: "#3730a3", badge: "bg-indigo-100 text-indigo-800 ring-indigo-200" },
  "Health & Fitness":        { hex: "#134e4a", badge: "bg-teal-100 text-teal-800 ring-teal-200" },
  "Entertainment & Leisure": { hex: "#6b21a8", badge: "bg-purple-100 text-purple-800 ring-purple-200" },
  "Charity":                 { hex: "#881337", badge: "bg-rose-100 text-rose-800 ring-rose-200" },
  "Cash & ATM":              { hex: "#57534e", badge: "bg-stone-100 text-stone-700 ring-stone-200" },
  "Transfers Received":      { hex: "#065f46", badge: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  "Transfers Sent":          { hex: "#991b1b", badge: "bg-red-100 text-red-800 ring-red-200" },
  "Refunds":                 { hex: "#166534", badge: "bg-green-100 text-green-800 ring-green-200" },
  "Finance & Bills":         { hex: "#1e40af", badge: "bg-blue-100 text-blue-800 ring-blue-200" },
  "Rent & Mortgage":         { hex: "#991b1b", badge: "bg-red-100 text-red-800 ring-red-200" },
  "Uncategorised":           { hex: "#6b7280", badge: "bg-gray-100 text-gray-700 ring-gray-200" },
  [UNKNOWN_CAT]:             { hex: "#6b7280", badge: "bg-gray-100 text-gray-700 ring-gray-200" },
};

const CAT_EMOJI = {
  "Groceries":               "🛒",
  "Eating Out":              "🍽️",
  "Online Shopping":         "🛍️",
  "High Street":             "🏪",
  "Travel & Transport":      "🚇",
  "Household Bills":         "🏠",
  "Direct Debits":           "📋",
  "Health & Fitness":        "💊",
  "Entertainment & Leisure": "🎭",
  "Charity":                 "❤️",
  "Cash & ATM":              "🏧",
  "Transfers Received":      "💸",
  "Transfers Sent":          "🔄",
  "Refunds":                 "↩️",
  "Finance & Bills":         "💳",
  "Rent & Mortgage":         "🏡",
  "Uncategorised":           "❓",
  [UNKNOWN_CAT]:             "❓",
};

// ─── Category pill colours ────────────────────────────────────────────────────
const CAT_PILL_STYLE = {
  "Groceries":               { bg: "#dcfce7", color: "#166534" },
  "Eating Out":              { bg: "#ffedd5", color: "#9a3412" },
  "Online Shopping":         { bg: "#fef9c3", color: "#854d0e" },
  "High Street":             { bg: "#fce7f3", color: "#9d174d" },
  "Travel & Transport":      { bg: "#dbeafe", color: "#1e40af" },
  "Household Bills":         { bg: "#f1f5f9", color: "#334155" },
  "Direct Debits":           { bg: "#e0e7ff", color: "#3730a3" },
  "Health & Fitness":        { bg: "#ccfbf1", color: "#134e4a" },
  "Entertainment & Leisure": { bg: "#f3e8ff", color: "#6b21a8" },
  "Charity":                 { bg: "#fce7f3", color: "#881337" },
  "Cash & ATM":              { bg: "#f5f5f4", color: "#57534e" },
  "Transfers Received":      { bg: "#d1fae5", color: "#065f46" },
  "Transfers Sent":          { bg: "#fee2e2", color: "#991b1b" },
  "Refunds":                 { bg: "#dcfce7", color: "#166534" },
  "Finance & Bills":         { bg: "#e0e7ff", color: "#1e40af" },
  "Rent & Mortgage":         { bg: "#fee2e2", color: "#991b1b" },
  "Uncategorised":           { bg: "#f9fafb", color: "#6b7280" },
  [UNKNOWN_CAT]:             { bg: "#f9fafb", color: "#6b7280" },
};

const CAT_TIPS = {
  "Groceries":               "Supermarkets, food stores, and online grocery delivery",
  "Eating Out":              "Restaurants, cafés, takeaways, pubs, and fast food",
  "Online Shopping":         "Amazon, eBay, ASOS, and other online retailers",
  "High Street":             "High street shops, salons, pharmacies, and vape stores",
  "Travel & Transport":      "Trains, buses, taxis, Uber, fuel, and parking",
  "Household Bills":         "Utilities, broadband, and council tax",
  "Direct Debits":           "Recurring subscriptions, insurance, and regular bills",
  "Health & Fitness":        "Pharmacy, gym, medical, dentist, and personal care",
  "Entertainment & Leisure": "Cinema, theatre, gaming, events, and hobbies",
  "Charity":                 "Charitable giving and donations",
  "Cash & ATM":              "ATM withdrawals and cash transactions",
  "Transfers Received":      "Incoming bank transfers and faster payments",
  "Transfers Sent":          "Outgoing bank transfers and payments to individuals",
  "Refunds":                 "Refunds and cashbacks from retailers",
  "Finance & Bills":         "Loans, hire purchase, and financial services",
  "Rent & Mortgage":         "Rent payments and mortgage repayments",
  "Uncategorised":           "Transactions that couldn't be automatically categorised",
  [UNKNOWN_CAT]:             "Transactions that couldn't be automatically categorised",
};

function catHex(name)   { return (CAT_CONFIG[name] ?? CAT_CONFIG[UNKNOWN_CAT]).hex; }
function catBadge(name) { return (CAT_CONFIG[name] ?? CAT_CONFIG[UNKNOWN_CAT]).badge; }
function catEmoji(name) { return CAT_EMOJI[name] ?? "❓"; }

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

// ─── Module-level date parser (shared by FinancialSummary + Dashboard) ───────
const _DMI = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
function parseDateStr(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (m) return new Date(+m[3], _DMI[m[2]] ?? 0, +m[1]);
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ name }) {
  const pill = CAT_PILL_STYLE[name] ?? { bg: "#f9fafb", color: "#6b7280" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: pill.bg, color: pill.color, padding: "4px 10px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      {catEmoji(name)} {name}
    </span>
  );
}

// Vibrant gradient stat card
function StatCard({ label, value, sub, gradient, icon, loaded, delay, countTarget, countTriggered, countFormat, gauge }) {
  const _counted = useCountUp(
    countTarget ?? 0,
    1500,
    countTarget !== undefined ? (countTriggered ?? false) : false,
  );
  const displayValue = countTarget !== undefined
    ? (countFormat ? countFormat(_counted) : Math.round(_counted).toString())
    : value;

  const numLen = (displayValue?.toString() ?? "").length;
  const numFontSize = numLen <= 6 ? "2rem" : numLen <= 8 ? "1.75rem" : numLen <= 10 ? "1.5rem" : "1.25rem";

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
        <p className="font-extrabold text-white mt-1 leading-none" style={{ fontSize: numFontSize, whiteSpace: "nowrap" }}>{displayValue}</p>
        {sub && <p className="text-sm text-white/60 mt-1.5">{sub}</p>}
        {gauge && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gauge.pct}%`, background: gauge.color, borderRadius: 3, transition: "width 1s ease 0.6s" }} />
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "0.68rem", color: "rgba(255,255,255,0.72)" }}>{gauge.label}</p>
          </div>
        )}
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

// ─── Unified Financial Summary ────────────────────────────────────────────────
function FinancialSummary({ transactions, income, expenses, net, categoryBreakdown, dateRange, insights, onWeekClick, activeWeek }) {
  const [showWhy, setShowWhy] = useState(false);

  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const parsedDates = transactions.map(t => parseDateStr(t.date)).filter(d => d && !isNaN(d));
  parsedDates.sort((a, b) => a - b);
  const dayCount = parsedDates.length >= 2
    ? Math.max(1, Math.round((parsedDates[parsedDates.length - 1] - parsedDates[0]) / 86400000) + 1)
    : 30;

  const debits = transactions.filter(t => t.amount < 0);

  // ── Spending personality ──
  const SKIP_CATS = new Set(["Transfers Received","Transfers Sent","Refunds","Direct Debits","Finance & Bills"]);
  const topCat = categoryBreakdown.find(c => !SKIP_CATS.has(c.name));
  const PERSONALITIES = {
    default:     { emoji: "⚖️", name: "The Balanced Budgeter",  desc: "You spread your spending evenly — no obvious weak spots",              gradient: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)" },
    homebody:    { emoji: "🏠", name: "The Homebody",           desc: "Home & essentials are your biggest priority this month",               gradient: "linear-gradient(135deg,#4facfe 0%,#00c9ff 100%)" },
    foodie:      { emoji: "🍕", name: "The Foodie",             desc: "Restaurants & cafes take the top spot — you love eating out",          gradient: "linear-gradient(135deg,#f6d365 0%,#fda085 100%)" },
    subscriber:  { emoji: "📋", name: "The Bill Payer",         desc: "Regular bills & direct debits dominate your outgoings",               gradient: "linear-gradient(135deg,#a18cd1 0%,#fbc2eb 100%)" },
    shopper:     { emoji: "🛍️", name: "The Shopper",            desc: "Retail therapy is real — shopping leads your spending this month",     gradient: "linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)" },
    commuter:    { emoji: "🚇", name: "The Commuter",           desc: "Getting around costs you the most — transport is your #1 category",   gradient: "linear-gradient(135deg,#30cfd0 0%,#5f72bd 100%)" },
    entertainer: { emoji: "🎭", name: "The Entertainer",        desc: "Entertainment & leisure is where you splash out the most",             gradient: "linear-gradient(135deg,#cd9cf2 0%,#8b5cf6 100%)" },
    wellness:    { emoji: "💪", name: "The Wellness Warrior",   desc: "Health & fitness is a clear priority — you invest in yourself",        gradient: "linear-gradient(135deg,#f093fb 0%,#f5576c 100%)" },
  };
  let personality = PERSONALITIES.default;
  if (topCat) {
    const n = topCat.name;
    if (["Groceries","Household Bills","Rent & Mortgage"].includes(n)) personality = PERSONALITIES.homebody;
    else if (n === "Eating Out")              personality = PERSONALITIES.foodie;
    else if (n === "Direct Debits")           personality = PERSONALITIES.subscriber;
    else if (n === "Online Shopping" || n === "High Street") personality = PERSONALITIES.shopper;
    else if (n === "Travel & Transport")      personality = PERSONALITIES.commuter;
    else if (n === "Entertainment & Leisure") personality = PERSONALITIES.entertainer;
    else if (n === "Health & Fitness")        personality = PERSONALITIES.wellness;
  }

  // ── Top 5 merchants (used in why text + card C) ──
  const merchantMap = {};
  debits.forEach(t => {
    const n = t.description;
    if (!merchantMap[n]) merchantMap[n] = { name: n, total: 0, count: 0 };
    merchantMap[n].total += Math.abs(t.amount);
    merchantMap[n].count++;
  });
  const top5Merchants = Object.values(merchantMap).sort((a,b) => b.total - a.total).slice(0, 5);
  const maxMerchantTotal = top5Merchants[0]?.total ?? 1;

  // ── Why explanation (Upgrade 4) ──
  const topCatPct  = topCat && expenses > 0 ? ((topCat.total / expenses) * 100).toFixed(0) : "0";
  const topCatName = topCat?.name ?? "various categories";
  const top3Total  = top5Merchants.slice(0,3).reduce((s,m) => s + m.total, 0);
  const numSpendCats = categoryBreakdown.filter(c => !SKIP_CATS.has(c.name)).length;
  const pn = personality.name;
  let whyText = `Your spending is evenly spread — ${topCatName} was your biggest area at ${topCatPct}%, but no single category dominates. You spread spend across ${numSpendCats} different categories.`;
  if      (pn === "The Homebody")          whyText = `${topCatPct}% of your spending went on ${topCatName}. Home essentials and bills lead your budget — a solid foundation. Your top 3 merchants account for ${fmt(top3Total)} combined.`;
  else if (pn === "The Foodie")            whyText = `${topCatPct}% of your money went to ${topCatName}. Eating out and cafes are clearly a lifestyle choice. Your top 3 food merchants account for ${fmt(top3Total)}.`;
  else if (pn === "The Streamer")          whyText = `${topCatPct}% of your spending is on ${topCatName}. Recurring services add up fast — your top 3 merchants alone total ${fmt(top3Total)}. Check if all are still in use.`;
  else if (pn === "The Shopper")           whyText = `${topCatPct}% of your budget went to ${topCatName}. Online and high street shopping leads your spending. Your top 3 retailers account for ${fmt(top3Total)} this period.`;
  else if (pn === "The Commuter")          whyText = `${topCatPct}% of your spending is on ${topCatName}. Travel costs are your biggest outgoing. Your top 3 transport merchants total ${fmt(top3Total)} for the period.`;
  else if (pn === "The Entertainer")       whyText = `${topCatPct}% of your spending is on ${topCatName}. You invest heavily in experiences. Your top 3 entertainment merchants account for ${fmt(top3Total)}.`;
  else if (pn === "The Wellness Warrior")  whyText = `${topCatPct}% of your budget is on ${topCatName}. Health is your priority — gym memberships, pharmacies, and wellness services lead your spend. Top 3 merchants: ${fmt(top3Total)}.`;

  // ── Busiest day of week ──
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dayTotals = {};
  debits.forEach(t => {
    const d = parseDateStr(t.date);
    if (!d) return;
    const day = DAY_NAMES[d.getDay()];
    dayTotals[day] = (dayTotals[day] || 0) + Math.abs(t.amount);
  });
  const busiestDay = Object.entries(dayTotals).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null;

  // ── Biggest single debit ──
  const biggestDebit = debits.slice().sort((a,b) => a.amount - b.amount)[0] ?? null;

  // ── Heaviest 7-day sliding window ──
  let heaviestWeekLabel = null;
  if (parsedDates.length >= 2) {
    const datedDebits = debits
      .map(t => ({ date: parseDateStr(t.date), amount: Math.abs(t.amount) }))
      .filter(t => t.date)
      .sort((a,b) => a.date - b.date);
    let bestTotal = 0, bestStart = null;
    datedDebits.forEach(({ date }) => {
      const windowEnd = new Date(date.getTime() + 6 * 86400000);
      const wTotal = datedDebits.filter(d => d.date >= date && d.date <= windowEnd).reduce((s,d) => s + d.amount, 0);
      if (wTotal > bestTotal) { bestTotal = wTotal; bestStart = date; }
    });
    if (bestStart) {
      const bestEnd = new Date(bestStart.getTime() + 6 * 86400000);
      heaviestWeekLabel = `${bestStart.getDate()} ${MONTHS_SHORT[bestStart.getMonth()]} – ${bestEnd.getDate()} ${MONTHS_SHORT[bestEnd.getMonth()]}`;
    }
  }

  // ── Recurring badge ──
  const RANK_EMOJI = ["🥇","🥈","🥉","4️⃣","5️⃣"];
  const RECURRING_KEYWORDS = ["netflix","spotify","apple","google one","amazon prime","prime video","disney","sky","now tv","nowtv","gym","pure gym","planet fitness","headspace","duolingo","adobe","microsoft","icloud","youtube","audible","deliveroo plus","uber one","just eat"];
  const isRecurring = (name) => RECURRING_KEYWORDS.some(k => name.toLowerCase().includes(k));

  // ── Weekly spend breakdown (Upgrade 2 — clickable bars) ──
  const weekTotals = [0, 0, 0, 0];
  if (parsedDates.length >= 1) {
    debits.forEach(t => {
      const d = parseDateStr(t.date);
      if (!d) return;
      const dayOffset = Math.round((d - parsedDates[0]) / 86400000);
      const wIdx = Math.min(3, Math.floor(dayOffset / (dayCount / 4)));
      weekTotals[wIdx] += Math.abs(t.amount);
    });
  }
  const maxWeekIdx  = weekTotals.indexOf(Math.max(...weekTotals));
  const weekBarData = weekTotals.map((total, i) => ({
    name: `Week ${i+1}`,
    total,
    fill: activeWeek != null
      ? (i === activeWeek ? "#6c5ce7" : "#ddd6fe")
      : (i === maxWeekIdx ? "#6c5ce7" : "#ddd6fe"),
  }));

  // ── Computed alerts ──
  const computedAlerts = [];
  const uncatTotal = categoryBreakdown.find(c => c.name === "Uncategorised")?.total ?? 0;
  if (expenses > 0 && uncatTotal / expenses > 0.30)
    computedAlerts.push({ type: "warning", icon: "⚠️", text: `Large uncategorised spending — ${fmt(uncatTotal)} needs review` });
  if (top5Merchants.length > 0 && expenses > 0) {
    const pct = (top5Merchants[0].total / expenses) * 100;
    if (pct > 25)
      computedAlerts.push({ type: "warning", icon: "⚠️", text: `${top5Merchants[0].name} is your biggest expense at ${pct.toFixed(0)}% of spending` });
  }
  if (income > 0 && expenses > income)
    computedAlerts.push({ type: "danger", icon: "🔴", text: "You spent more than you earned this period" });
  const cashTotal = categoryBreakdown.find(c => c.name === "Cash & ATM")?.total ?? 0;
  if (cashTotal > 200)
    computedAlerts.push({ type: "info", icon: "💵", text: `${fmt(cashTotal)} withdrawn as cash — harder to track` });
  const alerts = computedAlerts.slice(0, 3);

  // ── Score ──
  const score      = insights?.spendingScore ?? 0;
  const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Attention";

  const ALERT_BORDER = { danger: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };
  const ALERT_BG     = { danger: "#fff1f1", warning: "#fffbeb", info: "#eff6ff" };
  const ALERT_RING   = { danger: "#fecaca", warning: "#fde68a", info: "#bfdbfe" };

  const sectionLabel = (text) => (
    <p style={{ margin: "0 0 14px", fontSize: "0.62rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>{text}</p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 12px rgba(0,0,0,0.07)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, border: "1px solid #f1f5f9" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>✨ Your Money, Explained</h2>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, background: "linear-gradient(135deg,#6c5ce7 0%,#a29bfe 100%)", color: "#fff", padding: "3px 10px", borderRadius: 20, letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0 }}>StatementFlow AI</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>Here's what stood out this month</p>
        </div>
        {score > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: scoreColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</p>
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, color: "#64748b" }}>{scoreLabel}</p>
            </div>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: scoreColor, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${scoreColor}44`, flexShrink: 0 }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{score}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── ROW 1: Personality + Money Moments ── */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14, alignItems: "stretch" }}>

        {/* Card A — Spending Personality with "Why?" toggle (Upgrade 4) */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, borderRadius: showWhy ? "12px 12px 0 0" : 12, boxShadow: "0 2px 16px rgba(0,0,0,0.12)", padding: 24, background: personality.gradient, minHeight: 168, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", bottom: -28, left: -12, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <p style={{ margin: "0 0 8px", fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Spending Personality</p>
            <div style={{ fontSize: "3rem", lineHeight: 1, marginBottom: 10 }}>{personality.emoji}</div>
            <p style={{ margin: "0 0 4px", fontSize: "1.22rem", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{personality.name}</p>
            <button
              onClick={() => setShowWhy(v => !v)}
              style={{ display: "inline-block", background: "none", border: "none", padding: "0 0 8px", cursor: "pointer", fontSize: "0.75rem", color: "rgba(255,255,255,0.72)", textAlign: "left" }}
            >
              {showWhy ? "Close ✕" : "Why? →"}
            </button>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.78)", lineHeight: 1.45 }}>{personality.desc}</p>
          </div>
          {showWhy && (
            <div style={{ background: "#f8f7ff", borderTop: "1px solid #ede9fe", borderRadius: "0 0 12px 12px", padding: "14px 20px", boxShadow: "0 4px 12px rgba(108,92,231,0.08)" }}>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#334155", lineHeight: 1.6 }}>{whyText}</p>
            </div>
          )}
        </div>

        {/* Card B — Money Moments */}
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 12px rgba(0,0,0,0.07)", padding: 24, border: "1px solid #f1f5f9", height: "100%", boxSizing: "border-box" }}>
          {sectionLabel("Money Moments")}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {busiestDay && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1 }}>📅</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "#94a3b8" }}>Busiest spend day</p>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{busiestDay}s</p>
                </div>
              </div>
            )}
            {biggestDebit && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1 }}>💸</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "#94a3b8" }}>Biggest single transaction</p>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>
                    {fmt(Math.abs(biggestDebit.amount))}
                    <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#64748b" }}> · {biggestDebit.description.length > 22 ? biggestDebit.description.slice(0,22)+"…" : biggestDebit.description}</span>
                  </p>
                </div>
              </div>
            )}
            {heaviestWeekLabel && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0 0" }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1 }}>📆</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "#94a3b8" }}>Heaviest week</p>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{heaviestWeekLabel}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Top Merchants ── */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 12px rgba(0,0,0,0.07)", padding: 24, border: "1px solid #f1f5f9" }}>
        {sectionLabel("Where Your Money Actually Went")}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {top5Merchants.length === 0 && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>No spending data available.</p>
          )}
          {top5Merchants.map((m, i) => {
            const barPct = (m.total / maxMerchantTotal) * 100;
            return (
              <div key={m.name} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#fafafa" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${barPct}%`, background: i === 0 ? "#f3f0ff" : "#f8fafc", borderRadius: 8, zIndex: 0 }} />
                <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>{RANK_EMOJI[i]}</span>
                  <span style={{ flex: 1, fontSize: "0.86rem", fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  {isRecurring(m.name) && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "#ede9fe", color: "#6d28d9", padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0 }}>🔄 Regular</span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 }}>{m.count} txn{m.count !== 1 ? "s" : ""}</span>
                  <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#1e293b", whiteSpace: "nowrap", flexShrink: 0, minWidth: 72, textAlign: "right" }}>{fmt(m.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ROW 3: Spending Rhythm (clickable) + Alerts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>

        {/* Card D — Spending Rhythm (Upgrade 2) */}
        <div className={alerts.length === 0 ? "md:col-span-2" : ""} style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 12px rgba(0,0,0,0.07)", padding: 24, border: "1px solid #f1f5f9" }}>
          {sectionLabel("Spending Rhythm")}
          <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#64748b" }}>
            {onWeekClick ? "Tap a bar to filter transactions by week" : "When you spent most"}
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekBarData} barSize={38} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis hide />
              <Bar
                dataKey="total"
                radius={[4,4,0,0]}
                cursor={onWeekClick ? "pointer" : "default"}
                onClick={(data, index) => onWeekClick && onWeekClick(index)}
              >
                {weekBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ margin: "6px 0 0", fontSize: "0.73rem", fontWeight: 600, color: "#6c5ce7", textAlign: "center" }}>
            {activeWeek != null
              ? `Showing Week ${activeWeek + 1} — click bar again to clear`
              : `Week ${maxWeekIdx + 1} was your biggest spending week`}
          </p>
        </div>

        {/* Card E — Key Alerts */}
        {alerts.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 12px rgba(0,0,0,0.07)", padding: 24, border: "1px solid #f1f5f9" }}>
            {sectionLabel("Key Alerts")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 8, background: ALERT_BG[a.type], borderTop: `1px solid ${ALERT_RING[a.type]}`, borderRight: `1px solid ${ALERT_RING[a.type]}`, borderBottom: `1px solid ${ALERT_RING[a.type]}`, borderLeft: `4px solid ${ALERT_BORDER[a.type]}` }}>
                  <p style={{ margin: 0, fontSize: "0.83rem", fontWeight: 600, color: "#1e293b", lineHeight: 1.45 }}>{a.icon} {a.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function Dashboard({ transactions, demoMode = false, confidence, bank, debug, insights, overdraftLimit = 500, internalTransferTotal = 0, reversalsCount = 0 }) {
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
  const [weekFilter, setWeekFilter]           = useState(null);

  // Animation states
  const [loaded,          setLoaded]          = useState(false);
  const [barsVisible,     setBarsVisible]     = useState(false);
  const [rowsHiding,      setRowsHiding]      = useState(false);
  const [rowFadeKey,      setRowFadeKey]      = useState(0);
  const [demoTriggered,   setDemoTriggered]   = useState(false);
  const [chartsTriggered, setChartsTriggered] = useState(false);

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
  const demoRef    = useRef(null);
  const chartsRef  = useRef(null);
  const txTableRef = useRef(null);
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

  // ── Week ranges for click-to-filter (Upgrade 2) ──
  const weekRanges = useMemo(() => {
    const dates = transactions.map(t => parseDateStr(t.date)).filter(d => d && !isNaN(d));
    dates.sort((a,b) => a - b);
    if (dates.length < 2) return null;
    const dc = Math.max(1, Math.round((dates[dates.length-1] - dates[0]) / 86400000) + 1);
    const MS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return [0,1,2,3].map(i => {
      const startOff = Math.round(i * dc / 4);
      const endOff   = Math.round((i+1) * dc / 4) - 1;
      const start = new Date(dates[0].getTime() + startOff * 86400000);
      const end   = new Date(dates[0].getTime() + endOff   * 86400000);
      return { start, end, label: `${start.getDate()} ${MS[start.getMonth()]} – ${end.getDate()} ${MS[end.getMonth()]}` };
    });
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
      if (t.exclude || t.excludeFromTotals) continue;
      if (t.amount > 0) { income += t.amount; incomeCount++; }
      else { expenses += Math.abs(t.amount); expenseCount++; }
    }
    return { income, expenses, net: income - expenses, incomeCount, expenseCount };
  }, [transactions]);

  // ── Net balance liquidity gauge (Upgrade 1) ──
  const netGauge = useMemo(() => {
    const limit = overdraftLimit || 500;
    const range = limit * 2;
    const pct = Math.max(0, Math.min(100, ((net + limit) / range) * 100));
    if (net >= limit) return { pct, color: "#4ade80", label: `${fmt(net)} positive balance` };
    if (net >= 0)     return { pct, color: "#fbbf24", label: `${fmt(limit - net)} until overdraft` };
    return { pct, color: "#f87171", label: `${fmt(Math.abs(net))} overdrawn` };
  }, [net, overdraftLimit]);

  // ── Demo toast helper ──
  const showDemoToast = useCallback(() => {
    setDemoToast(true);
    setTimeout(() => setDemoToast(false), 3000);
  }, []);

  // ── Week click → filter + scroll (Upgrade 2) ──
  const handleWeekClick = useCallback((idx) => {
    const next = weekFilter === idx ? null : idx;
    setWeekFilter(next);
    setPage(1);
    if (next !== null) {
      setTxExpanded(true);
      setTimeout(() => txTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [weekFilter]);

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
      if (t.exclude || t.excludeFromTotals) continue;
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

  // ── Subscription detection for transaction table indicator ──
  const subscriptionMerchants = useMemo(() => {
    // Use backend-detected subscriptions if available; otherwise fall back to pattern detection
    if (insights?.subscriptions?.list?.length > 0) {
      // Backend list items are "Merchant Name £amount" — extract just the merchant portion
      return new Set(
        insights.subscriptions.list.map(s => s.replace(/\s+£[\d.]+$/, "").trim())
      );
    }
    // Pattern fallback: same merchant, same exact amount, 2+ times, exclude common shops
    const NEVER_SUBS = ["tesco","sainsbury","asda","morrisons","waitrose","lidl","aldi","co-op","m&s","iceland","amazon","amzn","ebay","argos","currys","mcdonald","kfc","subway","greggs","costa","starbucks","deliveroo","just eat","uber","tfl","petrol","bp","shell","boots","atm","cash","paypal","transfer"];
    const amountCounts = {};
    transactions.forEach(t => {
      if (t.type !== "debit") return;
      const key = `${t.description}||${Math.abs(t.amount).toFixed(2)}`;
      amountCounts[key] = (amountCounts[key] || 0) + 1;
    });
    return new Set(
      Object.entries(amountCounts)
        .filter(([key, count]) => {
          if (count < 2) return false;
          const name = key.split("||")[0].toLowerCase();
          return !NEVER_SUBS.some(s => name.includes(s));
        })
        .map(([key]) => key.split("||")[0])
    );
  }, [transactions, insights]);

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
      let matchWeek = true;
      if (weekFilter !== null && weekRanges) {
        const wr = weekRanges[weekFilter];
        const d  = parseDateStr(t.date);
        if (d) matchWeek = d >= wr.start && d <= wr.end;
      }
      return matchSearch && matchCat && matchType && matchWeek;
    });
  }, [transactions, search, filterCat, filterType, weekFilter, weekRanges]);

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

      {/* ── STATEMENT SUBTITLE ── */}
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
        {transactions.length} transactions analysed{dateRange ? ` · ${dateRange}` : ""}
        {(bank && bank !== "ai-parsed") ? ` · ${bank}` : bankName ? ` · ${bankName}` : ""}
      </p>

      {/* ── EXPORT TOOLBAR ── */}
      <ExportToolbar downloading={downloading} onDownload={handleDownload} onCSV={handleCSV} downloadError={downloadError} />

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
          countTarget={income}
          countTriggered={demoMode ? demoTriggered : loaded}
          countFormat={(v) => fmt(v)}
        />
        <StatCard
          label="Total Money Out"
          value={fmt(expenses)}
          sub={
            internalTransferTotal > 0
              ? `Excl. ${fmt(internalTransferTotal)} internal transfers${reversalsCount > 0 ? ` · ${reversalsCount} refund${reversalsCount !== 1 ? "s" : ""} netted` : ""}`
              : reversalsCount > 0
                ? `${reversalsCount} refund${reversalsCount !== 1 ? "s" : ""} netted out automatically`
                : `${expenseCount} debit${expenseCount !== 1 ? "s" : ""}`
          }
          gradient="linear-gradient(135deg, #e17055 0%, #d63031 100%)"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>}
          loaded={loaded}
          delay={200}
          countTarget={expenses}
          countTriggered={demoMode ? demoTriggered : loaded}
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
          countTarget={Math.abs(net)}
          countTriggered={demoMode ? demoTriggered : loaded}
          countFormat={(v) => fmt(net >= 0 ? v : -v)}
          gauge={netGauge}
        />
        <StatCard
          label="Transactions"
          value={`${transactions.length}`}
          sub={`${incomeCount} in · ${expenseCount} out`}
          gradient="linear-gradient(135deg, #fd79a8 0%, #e84393 100%)"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          loaded={loaded}
          delay={400}
          countTarget={transactions.length}
          countTriggered={demoMode ? demoTriggered : loaded}
          countFormat={(v) => Math.round(v).toString()}
        />
      </div>

      {/* ── UNIFIED FINANCIAL SUMMARY ── */}
      {transactions.length > 0 && (
        <FinancialSummary
          transactions={transactions}
          income={income}
          expenses={expenses}
          net={net}
          categoryBreakdown={categoryBreakdown}
          dateRange={dateRange}
          insights={insights}
          onWeekClick={handleWeekClick}
          activeWeek={weekFilter}
        />
      )}

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
                  {/* Top row: emoji + name + tooltip + pct badge */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{catEmoji(name)}</span>
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
      <div ref={txTableRef} style={sectionStyle(550)}>
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

        {/* Week filter pill (Upgrade 2) */}
        {weekFilter !== null && weekRanges && (
          <div style={{ marginTop: 10, marginBottom: 2 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#6c5ce7", color: "#fff", padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600 }}>
              📅 Showing Week {weekFilter + 1} ({weekRanges[weekFilter].label})
              <button
                onClick={() => { setWeekFilter(null); setPage(1); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.82)", cursor: "pointer", padding: 0, fontSize: "1rem", lineHeight: 1, fontWeight: 700 }}
              >✕</button>
            </span>
          </div>
        )}

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
