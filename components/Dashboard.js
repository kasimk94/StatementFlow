"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Label,
} from "recharts";
import UpgradeModal from "@/components/UpgradeModal";

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

// Categories that are transfers — excluded from spending donut/percentages
const TRANSFER_CATS = new Set(["Transfers Sent", "Transfers Received", "Internal Transfer"]);

// Known merchant terms — bail out of person-name check if matched
const KNOWN_MERCHANTS_RE = /tesco|asda|sainsbury|morrisons|lidl|aldi|waitrose|amazon|argos|boots|costa|starbucks|mcdonald|greggs|subway|domino|deliveroo|paypal|netflix|spotify|google|apple|currys|ebay|primark|wilko|barclays|natwest|hsbc|starling|revolut|lloyds|santander|nationwide|halifax|next|marks|superdrug|ikea|asos|boohoo|uber|autotrader|paypoint|caffe|pret|nando|wagamama|gym|fitness|pharmacy|dentist|council|insurance|virgin|sky|vodafone|three|talktalk|broadband/i;

// Common UK first names — first word match is a strong signal of a person name
const COMMON_FIRST_NAMES = new Set([
  "kasam","kasim","mohammed","mohammad","muhammad","ahmed","ali","khan","zeeshan","waleed",
  "samra","khadija","fatima","aisha","maryam","yasmin","zara","leyla","ibrahim","omar","yusuf",
  "john","james","david","robert","michael","william","richard","thomas","mark","paul","andrew",
  "peter","stephen","gary","kevin","brian","tony","jason","adam","ryan","daniel","christopher",
  "sarah","emma","emily","jessica","laura","sophie","hannah","amy","lucy","charlotte","olivia",
  "chloe","grace","ella","megan","lauren","helen","claire","rachel","amanda","victoria",
  "smith","jones","taylor","brown","wilson","johnson","williams","davies","evans","harris",
  "walker","robinson","thompson","white","martin","jackson","wood","clarke","hall","green",
]);

function looksLikePersonName(name) {
  if (!name) return false;
  // Title prefix → definitely a person
  if (/^(mr\.?\s|mrs\.?\s|ms\.?\s|miss\.?\s|dr\.?\s)/i.test(name)) return true;
  // Strip trailing digits, ref codes before testing
  const s = name
    .replace(/\s+\d{4,}\s*$/, "")
    .replace(/\s+ref:?\s*\S+\s*$/i, "")
    .trim();
  // Bail out for known merchants
  if (KNOWN_MERCHANTS_RE.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 5 || /\d/.test(s)) return false;
  // Every word must start with a capital letter (allow single-letter initials like "K")
  if (!words.every(w => /^[A-Z][a-zA-Z]{0,}$/.test(w))) return false;
  // First word is a known first name → strong signal
  if (COMMON_FIRST_NAMES.has(words[0].toLowerCase())) return true;
  // Last word is a known surname → moderate signal
  if (COMMON_FIRST_NAMES.has(words[words.length - 1].toLowerCase())) return true;
  // 2-3 all-caps-starting words, none longer than 12 chars → likely a name
  if (words.length <= 3 && words.every(w => w.length <= 12)) return true;
  return false;
}

// Clean merchant display name — strip "Limited" suffixes, trailing ref codes, appended person names
function cleanMerchantDisplay(name) {
  if (!name) return name;
  let n = name
    .replace(/\s+limited\b.*$/i, "")    // truncate at "Limited ..."
    .replace(/\s+ltd\.?\b.*$/i, "")     // truncate at "Ltd ..."
    .replace(/\s+[A-Za-z]{1,3}\d+\w*\s*$/, "") // strip trailing ref codes e.g. "Ld10wux"
    .trim();
  return n || name;
}

const CAT_CONFIG = {
  "Groceries":               { hex: "#16a34a" },
  "Eating Out":              { hex: "#ea580c" },
  "Online Shopping":         { hex: "#ca8a04" },
  "High Street":             { hex: "#db2777" },
  "Travel & Transport":      { hex: "#2563eb" },
  "Household Bills":         { hex: "#475569" },
  "Direct Debits":           { hex: "#4f46e5" },
  "Health & Fitness":        { hex: "#0d9488" },
  "Entertainment & Leisure": { hex: "#7c3aed" },
  "Charity":                 { hex: "#e11d48" },
  "Cash & ATM":              { hex: "#78716c" },
  "Transfers Received":      { hex: "#059669" },
  "Transfers Sent":          { hex: "#dc2626" },
  "Refunds":                 { hex: "#0891b2" },
  "Finance & Bills":         { hex: "#1d4ed8" },
  "Rent & Mortgage":         { hex: "#b45309" },
  "Uncategorised":           { hex: "#9ca3af" },
  [UNKNOWN_CAT]:             { hex: "#9ca3af" },
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

// ─── Category pill colours (vivid solid colours, white text) ─────────────────
const CAT_PILL_STYLE = {
  "Groceries":               { bg: "#16a34a", color: "#ffffff" },
  "Eating Out":              { bg: "#ea580c", color: "#ffffff" },
  "Online Shopping":         { bg: "#ca8a04", color: "#ffffff" },
  "High Street":             { bg: "#db2777", color: "#ffffff" },
  "Travel & Transport":      { bg: "#2563eb", color: "#ffffff" },
  "Household Bills":         { bg: "#475569", color: "#ffffff" },
  "Direct Debits":           { bg: "#4f46e5", color: "#ffffff" },
  "Health & Fitness":        { bg: "#0d9488", color: "#ffffff" },
  "Entertainment & Leisure": { bg: "#7c3aed", color: "#ffffff" },
  "Charity":                 { bg: "#e11d48", color: "#ffffff" },
  "Cash & ATM":              { bg: "#78716c", color: "#ffffff" },
  "Transfers Received":      { bg: "#059669", color: "#ffffff" },
  "Transfers Sent":          { bg: "#dc2626", color: "#ffffff" },
  "Refunds":                 { bg: "#0891b2", color: "#ffffff" },
  "Finance & Bills":         { bg: "#1d4ed8", color: "#ffffff" },
  "Rent & Mortgage":         { bg: "#b45309", color: "#ffffff" },
  "Uncategorised":           { bg: "#9ca3af", color: "#ffffff" },
  [UNKNOWN_CAT]:             { bg: "#9ca3af", color: "#ffffff" },
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
  // "DD Mon YYYY" — primary normalised format
  const m = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (m) return new Date(+m[3], _DMI[m[2]] ?? 0, +m[1]);
  // "DD/MM/YYYY" or "DD-MM-YYYY"
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return new Date(+m2[3], +m2[2] - 1, +m2[1]);
  // "DD/MM/YY" or "DD-MM-YY" (HSBC short year, e.g. "20-07-24")
  const m3 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m3) return new Date(2000 + +m3[3], +m3[2] - 1, +m3[1]);
  // "YYYY-MM-DD"
  const m4 = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m4) return new Date(+m4[1], +m4[2] - 1, +m4[3]);
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ name }) {
  const pill = CAT_PILL_STYLE[name] ?? { bg: "#1E2A3A", color: "#8A9BB5" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: pill.bg, color: pill.color, padding: "4px 10px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" }}>
      {catEmoji(name)} {name}
    </span>
  );
}

// Dark-gold themed stat card
function StatCard({ label, value, sub, gradient, border, shadow, numColor, icon, loaded, delay, countTarget, countTriggered, countFormat, gauge }) {
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
        border: border || "1px solid #1E2A3A",
        borderRadius: 16,
        boxShadow: shadow || "0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        opacity:    loaded ? 1 : 0,
        transform:  loaded ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
      }}
    >
      {/* Decorative background circles */}
      <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full" style={{ background: "rgba(255,255,255,0.03)" }} />
      <div className="pointer-events-none absolute -bottom-6 right-12 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.02)" }} />

      <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl" style={{ background: "rgba(255,255,255,0.08)", color: numColor || "#F5F0E8" }}>
        {icon}
      </div>
      <div className="relative min-w-0 flex-1">
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
        <p style={{ fontWeight: 800, color: numColor || "#F5F0E8", marginTop: 4, lineHeight: 1, fontSize: numFontSize, whiteSpace: "nowrap" }}>{displayValue}</p>
        {sub && <p style={{ fontSize: "0.82rem", color: "#8A9BB5", marginTop: 6 }}>{sub}</p>}
        {gauge && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gauge.pct}%`, background: gauge.color, borderRadius: 999, transition: "width 1s ease 0.6s" }} />
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "0.68rem", color: "#8A9BB5" }}>{gauge.label}</p>
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
    <div style={{ background: "#0D1117", border: "1px solid #1E2A3A", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "8px 14px", fontSize: "0.85rem" }}>
      <p style={{ fontWeight: 600, color: "#F5F0E8", marginBottom: 2 }}>{d.name}</p>
      <p style={{ color: d.payload?.fill ?? d.color }}>{fmt(d.value)}</p>
    </div>
  );
}

// Improved legend: colour dot + name + amount + percentage
function PieLegend({ data, totalExpenses }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
      {data.map((entry) => {
        const pct = totalExpenses > 0 ? ((entry.value / totalExpenses) * 100).toFixed(1) : "0.0";
        return (
          <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, backgroundColor: entry.fill }} />
            <span style={{ fontSize: "12px", color: "#F5F0E8", flex: 1 }}>{entry.name}</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#8A9BB5", flexShrink: 0 }}>{fmtShort(entry.value)}</span>
            <span
              style={{ fontSize: "0.75rem", color: "#fff", fontWeight: 600, backgroundColor: entry.fill, borderRadius: 999, padding: "2px 6px", minWidth: "3rem", textAlign: "center", flexShrink: 0 }}
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
    <div style={{ background: "#0D1117", border: "1px solid #1E2A3A", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "8px 14px", fontSize: "0.85rem" }}>
      <p style={{ fontWeight: 600, color: "#F5F0E8", marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill }}>{fmt(p.value)}</p>
      ))}
    </div>
  );
}

const PAGE_SIZE = 15;

// ─── Accountant View: P&L + VAT Summary + Business Expense Review ────────────
function AccountantView({ transactions, income, expenses, net, categoryBreakdown, vatSummary, dateRange, period, bank, bankName, reversalsCount = 0 }) {
  const [checkedRows, setCheckedRows] = useState(new Set());

  const periodStr = period
    ? (period.from && period.to ? `${period.from} – ${period.to}` : (period.to || dateRange || ""))
    : (dateRange || "");

  const internalCount = transactions.filter(t => t.isInternal).length;

  // Income breakdown by category
  const incomeByCategory = {};
  transactions.forEach(t => {
    if (t.exclude || t.excludeFromTotals || t.amount <= 0) return;
    const cat = t.category || "Other";
    incomeByCategory[cat] = (incomeByCategory[cat] || 0) + t.amount;
  });
  const incomeCategories = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);

  // Transactions to review: all debits except excluded categories
  const REVIEW_EXCLUDE = new Set(["Transfers Sent", "Cash & ATM", "Charity", "Groceries"]);
  const reviewTx = transactions.filter(t =>
    t.amount < 0 && !t.exclude && !t.excludeFromTotals && !REVIEW_EXCLUDE.has(t.category)
  ).sort((a, b) => a.amount - b.amount);

  // Selected totals
  const selectedTotal    = reviewTx.filter((_, i) => checkedRows.has(i)).reduce((s, t) => s + Math.abs(t.amount), 0);
  const selectedVATTotal = reviewTx.filter((_, i) => checkedRows.has(i)).reduce((s, t) => s + (t.vatAmount || 0), 0);

  function toggleRow(i) {
    setCheckedRows(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function toggleAll() {
    setCheckedRows(prev => prev.size === reviewTx.length ? new Set() : new Set(reviewTx.map((_, i) => i)));
  }

  // VAT data
  const vatBreakdown = vatSummary?.breakdown ?? {};
  const vatTotal     = vatSummary?.totalReclaimable ?? 0;
  const vatCount     = vatSummary?.transactionCount ?? 0;
  const vatCatRows   = categoryBreakdown
    .filter(c => c.total > 0 && !["Groceries","Cash & ATM","Transfers Sent","Transfers Received","Refunds","Charity","Rent & Mortgage"].includes(c.name))
    .map(c => ({ name: c.name, spend: c.total, vat: vatBreakdown[c.name] || 0 }));

  const rowStyle  = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1E2A3A", fontSize: "0.9rem" };
  const divStyle  = { borderTop: "2px solid #1E2A3A", margin: "4px 0" };
  const cardStyle = { background: "#0D1117", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.4)", padding: "24px 28px", border: "1px solid #1E2A3A", borderTop: "3px solid #C9A84C" };

  return (
    <div className="accountant-panel" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── MODE BANNER ── */}
      <div style={{ background: "linear-gradient(135deg, #0a1525, #111820)", borderRadius: 12, padding: "12px 20px", border: "1px solid rgba(201,168,76,0.2)" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#F5F0E8" }}>📊 Accountant View — Professional Analysis</p>
        <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#8A9BB5" }}>Switch to Personal View for the standard dashboard</p>
      </div>

      {/* ── RECONCILIATION STATUS BANNER ── */}
      <div className="recon-banner" style={{ background: "#0D1117", border: "1px solid #1E2A3A", borderLeft: "4px solid #00D4A0", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, background: "#00D4A0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#080C14", fontSize: 20, flexShrink: 0, fontWeight: 700 }}>✓</div>
        <div>
          <p style={{ fontWeight: 700, color: "#00D4A0", margin: "0 0 2px 0", fontSize: "0.95rem" }}>Statement Reconciled</p>
          <p style={{ color: "#8A9BB5", margin: 0, fontSize: "0.8rem" }}>
            All transactions verified · {reversalsCount} reversal{reversalsCount !== 1 ? "s" : ""} matched · {internalCount} internal transfer{internalCount !== 1 ? "s" : ""} excluded
          </p>
        </div>
        <div className="recon-banner-right" style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ fontWeight: 700, color: "#F5F0E8", margin: "0 0 2px 0", fontSize: "0.95rem" }}>Audit Ready</p>
          <p style={{ color: "#8A9BB5", margin: 0, fontSize: "0.75rem" }}>{new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      {/* ── CARD 1: P&L STATEMENT ── */}
      <div style={cardStyle} className="pl-card">
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#F5F0E8" }}>Profit &amp; Loss Summary</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#8A9BB5" }}>{periodStr} · Prepared by StatementFlow</p>
        </div>

        <div className="pl-grid">
          {/* Income */}
          <div>
            <p style={{ margin: "0 0 12px", fontSize: "0.7rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em" }}>Income</p>
            {incomeCategories.map(([cat, amt]) => (
              <div key={cat} style={rowStyle}>
                <span style={{ color: "#8A9BB5" }}>{cat}</span>
                <span style={{ fontWeight: 600, color: "#F5F0E8" }}>{fmt(amt)}</span>
              </div>
            ))}
            <div style={divStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", fontWeight: 800, fontSize: "0.95rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#00D4A0" }}>
                TOTAL INCOME
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,212,160,0.15)", color: "#00D4A0", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(0,212,160,0.3)" }}>✓ Verified</span>
              </span>
              <span style={{ color: "#00D4A0" }}>{fmt(income)}</span>
            </div>
          </div>

          {/* Expenditure */}
          <div>
            <p style={{ margin: "0 0 12px", fontSize: "0.7rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em" }}>Expenditure</p>
            {categoryBreakdown.filter(c => c.total > 0).map(({ name, total }) => (
              <div key={name} style={rowStyle}>
                <span style={{ color: "#8A9BB5" }}>{name}</span>
                <span style={{ fontWeight: 600, color: "#F5F0E8" }}>{fmt(total)}</span>
              </div>
            ))}
            <div style={divStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", fontWeight: 800, fontSize: "0.95rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#EF4444" }}>
                TOTAL EXPENDITURE
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,212,160,0.15)", color: "#00D4A0", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(0,212,160,0.3)" }}>✓ Verified</span>
              </span>
              <span style={{ color: "#EF4444" }}>{fmt(expenses)}</span>
            </div>
          </div>
        </div>

        {/* Net position */}
        <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 12, background: net >= 0 ? "rgba(0,212,160,0.08)" : "rgba(239,68,68,0.08)", border: `2px solid ${net >= 0 ? "rgba(0,212,160,0.3)" : "rgba(239,68,68,0.3)"}`, textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.78rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.06em" }}>Net Position</p>
          <p style={{ margin: 0, fontWeight: 900, fontSize: "1.6rem", color: net >= 0 ? "#00D4A0" : "#EF4444" }}>
            {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#8A9BB5" }}>{net >= 0 ? "Surplus for the period" : "Deficit for the period"}</p>
        </div>
      </div>

      {/* ── CARD 2: VAT SUMMARY ── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#F5F0E8" }}>Estimated VAT Reclaimable</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#8A9BB5" }}>Standard rate 20% · Verify all claims with HMRC</p>
        </div>

        <div className="vat-layout">
          {/* Left: total figure */}
          <div style={{ padding: "20px 24px", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 12, textAlign: "center", minWidth: 160 }}>
            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", fontWeight: 700, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Est. VAT</p>
            <p style={{ margin: "0 0 4px", fontSize: "2rem", fontWeight: 900, color: "#E8C97A", lineHeight: 1 }}>{fmt(vatTotal)}</p>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#8A9BB5" }}>across {vatCount} transaction{vatCount !== 1 ? "s" : ""}</p>
          </div>

          {/* Right: breakdown table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1E2A3A" }}>
                {["Category", "Gross Spend", "Est. VAT"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: h === "Category" ? "left" : "right", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vatCatRows.map(({ name, spend, vat }) => (
                <tr key={name} style={{ borderBottom: "1px solid #1E2A3A" }}>
                  <td style={{ padding: "6px 10px", color: "#8A9BB5" }}>{name}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#F5F0E8", fontWeight: 600 }}>{fmt(spend)}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: vat > 0 ? "#C9A84C" : "#4A5568", fontWeight: vat > 0 ? 700 : 400 }}>{fmt(vat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: "20px 0 0", fontSize: "0.75rem", color: "#8A9BB5", fontStyle: "italic", lineHeight: 1.6 }}>
          ⚠️ VAT estimates are based on standard 20% rate applied to gross amounts. Actual VAT reclaimable depends on your business type, VAT registration status, and HMRC guidelines. Always verify with a qualified accountant before submitting claims.
        </p>
      </div>

      {/* ── CARD 3: BUSINESS EXPENSE REVIEW ── */}
      {reviewTx.length > 0 && (
        <div style={cardStyle} className="no-print">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#F5F0E8" }}>Transactions to Review</h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#8A9BB5" }}>Flag which are genuine business expenses</p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #1E2A3A" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>VAT Est.</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#8A9BB5", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <input type="checkbox" checked={checkedRows.size === reviewTx.length && reviewTx.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} title="Select all" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviewTx.map((t, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid #1E2A3A", background: checkedRows.has(i) ? "rgba(201,168,76,0.08)" : (i % 2 === 0 ? "#0D1117" : "#111820"), cursor: "pointer" }}
                    onClick={() => toggleRow(i)}
                  >
                    <td style={{ padding: "8px 12px", color: "#8A9BB5", whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t.date}</td>
                    <td style={{ padding: "8px 12px", color: "#F5F0E8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                    <td style={{ padding: "8px 12px" }}><CategoryBadge name={t.category} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#EF4444" }}>{fmt(t.amount)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: t.vatAmount > 0 ? "#C9A84C" : "#4A5568", fontWeight: t.vatAmount > 0 ? 700 : 400 }}>{t.vatAmount > 0 ? fmt(t.vatAmount) : "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {t.isInternal
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(59,130,246,0.15)", color: "#93c5fd", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(59,130,246,0.3)" }}>↔ Internal</span>
                        : t.reversalLinked || t.excludeFromTotals
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(201,168,76,0.15)", color: "#C9A84C", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(201,168,76,0.3)" }}>⟳ Adjusted</span>
                        : t.category === "Uncategorised"
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(74,85,104,0.3)", color: "#8A9BB5", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid #1E2A3A" }}>? Review</span>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(0,212,160,0.15)", color: "#00D4A0", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(0,212,160,0.3)" }}>✓ Verified</span>}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }} onClick={e => { e.stopPropagation(); toggleRow(i); }}>
                      <input type="checkbox" checked={checkedRows.has(i)} onChange={() => toggleRow(i)} style={{ cursor: "pointer" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Running total */}
          <div style={{ marginTop: 12, padding: "12px 16px", background: checkedRows.size > 0 ? "rgba(201,168,76,0.08)" : "#111820", borderRadius: 10, border: `1px solid ${checkedRows.size > 0 ? "rgba(201,168,76,0.3)" : "#1E2A3A"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#8A9BB5" }}>
              {checkedRows.size === 0
                ? "Click rows to flag business expenses"
                : `${checkedRows.size} transaction${checkedRows.size !== 1 ? "s" : ""} selected`}
            </span>
            {checkedRows.size > 0 && (
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#C9A84C" }}>
                Selected total: {fmt(selectedTotal)} · Est. VAT: {fmt(selectedVATTotal)}
              </span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
// ─── Export toolbar (shared between real dashboard and demo) ─────────────────
function ExportToolbar({ downloading, onDownload, onCSV, onPrint, downloadError, isGuest }) {
  return (
    <div
      className="export-toolbar-inner"
      style={{
        background:   "#0D1117",
        borderRadius: 12,
        border:       "1px solid #1E2A3A",
        boxShadow:    "0 4px 24px rgba(0,0,0,0.3)",
        padding:      "10px 18px 10px 20px",
      }}
    >
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#F5F0E8" }}>Export Your Results</span>
        <span className="export-toolbar-label-sub" style={{ fontSize: "0.8rem", color: "#8A9BB5", fontWeight: 400 }}>— download your full statement report</span>
      </div>

      {/* Buttons */}
      <div className="export-toolbar-buttons">
        <button
          onClick={onPrint}
          style={{
            background:   "#1a2744",
            color:        "#93c5fd",
            fontWeight:   700,
            fontSize:     "0.88rem",
            padding:      "9px 20px",
            borderRadius: 11,
            border:       "1px solid rgba(59,130,246,0.5)",
            cursor:       "pointer",
            boxShadow:    "0 4px 14px rgba(59,130,246,0.15)",
            display:      "flex",
            alignItems:   "center",
            gap:          7,
            transition:   "transform 0.15s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(59,130,246,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 14px rgba(59,130,246,0.15)"; }}
        >
          <span style={{ fontSize: "1rem" }}>📄</span> Download Report
        </button>

        {!isGuest && (
          <button
            onClick={onDownload}
            disabled={downloading}
            style={{
              background:  "#1a3322",
              color:       "#86efac",
              fontWeight:  700,
              fontSize:    "0.88rem",
              padding:     "9px 20px",
              borderRadius: 11,
              border:      "1px solid rgba(34,197,94,0.5)",
              cursor:      downloading ? "not-allowed" : "pointer",
              opacity:     downloading ? 0.6 : 1,
              boxShadow:   "0 4px 14px rgba(34,197,94,0.1)",
              display:     "flex",
              alignItems:  "center",
              gap:         7,
              transition:  "transform 0.15s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => { if (!downloading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(34,197,94,0.25)"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(34,197,94,0.1)"; }}
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
        )}

        <button
          onClick={onCSV}
          style={{
            background:   "#1a2744",
            color:        "#93c5fd",
            fontWeight:   700,
            fontSize:     "0.88rem",
            padding:      "9px 20px",
            borderRadius: 11,
            border:       "1px solid rgba(59,130,246,0.5)",
            cursor:       "pointer",
            boxShadow:    "0 4px 14px rgba(59,130,246,0.15)",
            display:      "flex",
            alignItems:   "center",
            gap:          7,
            transition:   "transform 0.15s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(59,130,246,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 14px rgba(59,130,246,0.15)"; }}
        >
          <span style={{ fontSize: "1rem" }}>📄</span> Download CSV
        </button>
      </div>

      {downloadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "#EF4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "12px 16px", width: "100%" }}>
          <svg style={{ width: 16, height: 16, flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
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
    high:   { bg: "rgba(0,212,160,0.15)", text: "#00D4A0", border: "rgba(0,212,160,0.3)" },
    medium: { bg: "rgba(201,168,76,0.15)", text: "#C9A84C",  border: "rgba(201,168,76,0.3)" },
    low:    { bg: "rgba(239,68,68,0.15)", text: "#EF4444",   border: "rgba(239,68,68,0.3)" },
  }[debug.confidence] ?? { bg: "#111820", text: "#8A9BB5", border: "#1E2A3A" };

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
          <div style={{ color: "#8A9BB5", fontSize: "0.72rem", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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

  // ── Top 5 merchants ──
  // Excluded: internal flag, transfer categories, Flex/transfer by name, person names
  const MERCHANT_EXCLUDE_CATS = new Set(["Transfers Sent", "Transfers Received", "Internal Transfer"]);
  // Name-based exclusions — catches old saved statements where isInternal/category may not be set correctly
  const MERCHANT_EXCLUDE_NAME_RE = /\bflex\b|\bmonzo flex\b|\btransfer\b|\bpot\b|\bspace\b/i;

  function merchantKey(desc) {
    return (desc || "")
      .replace(/\s+\d{4,}\s*$/, "")
      .replace(/\s+ref:?\s*\S+\s*$/i, "")
      .replace(/\s+limited\b.*$/i, "")
      .replace(/\s+ltd\.?\b.*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  const merchantMap = {};
  debits
    .filter(t =>
      !t.isInternal &&
      !MERCHANT_EXCLUDE_CATS.has(t.category) &&
      !MERCHANT_EXCLUDE_NAME_RE.test(t.description) &&
      !looksLikePersonName(t.description)
    )
    .forEach(t => {
      const displayName = cleanMerchantDisplay(t.description);
      const key = merchantKey(t.description);
      if (!merchantMap[key]) merchantMap[key] = { name: displayName, total: 0, count: 0 };
      merchantMap[key].total += Math.abs(t.amount);
      merchantMap[key].count++;
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
      ? (i === activeWeek ? "#C9A84C" : "#1E2A3A")
      : (i === maxWeekIdx ? "#C9A84C" : "#1E2A3A"),
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

  const ALERT_BORDER = { danger: "#EF4444", warning: "#C9A84C", info: "#3b82f6" };
  const ALERT_BG     = { danger: "rgba(239,68,68,0.1)", warning: "rgba(201,168,76,0.1)", info: "rgba(59,130,246,0.1)" };
  const ALERT_RING   = { danger: "rgba(239,68,68,0.3)", warning: "rgba(201,168,76,0.3)", info: "rgba(59,130,246,0.3)" };

  const sectionLabel = (text) => (
    <p style={{ margin: "0 0 14px", fontSize: "0.62rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.1em" }}>{text}</p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── HEADER ── */}
      <div style={{ background: "#0D1117", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, border: "1px solid #1E2A3A" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#F5F0E8", borderLeft: "3px solid #C9A84C", paddingLeft: 12 }}>✨ Your Money, Explained</h2>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, background: "linear-gradient(135deg,#C9A84C,#E8C97A)", color: "#080C14", padding: "3px 10px", borderRadius: 20, letterSpacing: "0.02em", whiteSpace: "nowrap", flexShrink: 0 }}>StatementFlow AI</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#8A9BB5" }}>Here's what stood out this month</p>
        </div>
        {score > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: scoreColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</p>
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 600, color: "#8A9BB5" }}>{scoreLabel}</p>
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
          <div style={{ flex: 1, borderRadius: showWhy ? "12px 12px 0 0" : 12, boxShadow: "0 0 60px rgba(201,168,76,0.04), 0 4px 24px rgba(0,0,0,0.4)", padding: 24, background: "linear-gradient(135deg, #0a1206 0%, #111820 100%)", border: "1px solid rgba(201,168,76,0.2)", minHeight: 168, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
            <div style={{ position: "absolute", bottom: -28, left: -12, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <p style={{ margin: "0 0 8px", fontSize: "0.62rem", fontWeight: 700, color: "#8A9BB5", textTransform: "uppercase", letterSpacing: "0.1em" }}>Spending Personality</p>
            <div style={{ fontSize: "3rem", lineHeight: 1, marginBottom: 10 }}>{personality.emoji}</div>
            <p style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 700, color: "#C9A84C", lineHeight: 1.2, letterSpacing: "-0.02em" }}>{personality.name}</p>
            <button
              onClick={() => setShowWhy(v => !v)}
              style={{ display: "inline-block", background: "none", border: "none", padding: "0 0 8px", cursor: "pointer", fontSize: "0.75rem", color: "#C9A84C", textAlign: "left" }}
            >
              {showWhy ? "Close ✕" : "Why? →"}
            </button>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#8A9BB5", lineHeight: 1.45 }}>{personality.desc}</p>
          </div>
          {showWhy && (
            <div style={{ background: "#111820", borderTop: "1px solid rgba(201,168,76,0.2)", borderRadius: "0 0 12px 12px", padding: "14px 20px", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#8A9BB5", lineHeight: 1.6 }}>{whyText}</p>
            </div>
          )}
        </div>

        {/* Card B — Money Moments */}
        <div style={{ background: "#0D1117", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24, border: "1px solid #1E2A3A", height: "100%", boxSizing: "border-box" }}>
          {sectionLabel("Money Moments")}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {busiestDay && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #1E2A3A" }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1, color: "#C9A84C" }}>📅</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "#8A9BB5" }}>Busiest spend day</p>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#F5F0E8" }}>{busiestDay}s</p>
                </div>
              </div>
            )}
            {biggestDebit && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid #1E2A3A" }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1, color: "#C9A84C" }}>💸</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "#8A9BB5" }}>Biggest single transaction</p>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#F5F0E8" }}>
                    {fmt(Math.abs(biggestDebit.amount))}
                    <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#8A9BB5" }}> · {biggestDebit.description.length > 22 ? biggestDebit.description.slice(0,22)+"…" : biggestDebit.description}</span>
                  </p>
                </div>
              </div>
            )}
            {heaviestWeekLabel && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0 0" }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0, lineHeight: 1, color: "#C9A84C" }}>📆</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: "0.72rem", color: "#8A9BB5" }}>Heaviest week</p>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#F5F0E8" }}>{heaviestWeekLabel}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Top Merchants ── */}
      <div style={{ background: "#0D1117", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24, border: "1px solid #1E2A3A" }}>
        {sectionLabel("Where Your Money Actually Went")}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {top5Merchants.length === 0 && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#8A9BB5" }}>No spending data available.</p>
          )}
          {top5Merchants.map((m, i) => {
            const barPct = (m.total / maxMerchantTotal) * 100;
            return (
              <div key={m.name} style={{ position: "relative", borderRadius: 8, overflow: "hidden", background: "#111820", borderLeft: i === 0 ? "3px solid #C9A84C" : "none" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${barPct}%`, background: i === 0 ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.05)", borderRadius: 8, zIndex: 0 }} />
                <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                  <span style={{ fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>{RANK_EMOJI[i]}</span>
                  <span style={{ flex: 1, fontSize: "0.86rem", fontWeight: 500, color: "#F5F0E8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  {isRecurring(m.name) && (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(201,168,76,0.15)", color: "#C9A84C", padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap", flexShrink: 0, border: "1px solid rgba(201,168,76,0.3)" }}>🔄 Regular</span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "#8A9BB5", whiteSpace: "nowrap", flexShrink: 0 }}>{m.count} txn{m.count !== 1 ? "s" : ""}</span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#C9A84C", whiteSpace: "nowrap", flexShrink: 0, minWidth: 72, textAlign: "right" }}>{fmt(m.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ROW 3: Spending Rhythm (clickable) + Alerts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>

        {/* Card D — Spending Rhythm (Upgrade 2) */}
        <div className={alerts.length === 0 ? "md:col-span-2" : ""} style={{ background: "#0D1117", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24, border: "1px solid #1E2A3A" }}>
          {sectionLabel("Spending Rhythm")}
          <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#8A9BB5" }}>
            {onWeekClick ? "Tap a bar to filter transactions by week" : "When you spent most"}
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekBarData} barSize={38} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8A9BB5" }} />
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
          <p style={{ margin: "6px 0 0", fontSize: "0.73rem", fontWeight: 600, color: "#C9A84C", textAlign: "center" }}>
            {activeWeek != null
              ? `Showing Week ${activeWeek + 1} — click bar again to clear`
              : `Week ${maxWeekIdx + 1} was your biggest spending week`}
          </p>
        </div>

        {/* Card E — Key Alerts */}
        {alerts.length > 0 && (
          <div style={{ background: "#0D1117", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24, border: "1px solid #1E2A3A" }}>
            {sectionLabel("Key Alerts")}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 8, background: ALERT_BG[a.type], borderTop: `1px solid ${ALERT_RING[a.type]}`, borderRight: `1px solid ${ALERT_RING[a.type]}`, borderBottom: `1px solid ${ALERT_RING[a.type]}`, borderLeft: `4px solid ${ALERT_BORDER[a.type]}` }}>
                  <p style={{ margin: 0, fontSize: "0.83rem", fontWeight: 600, color: a.type === "danger" ? "#EF4444" : a.type === "warning" ? "#C9A84C" : "#8A9BB5", lineHeight: 1.45 }}>{a.icon} {a.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function Dashboard({ transactions, demoMode = false, confidence, bank, debug, insights, overdraftLimit = 500, internalTransferTotal = 0, reversalsCount = 0, statementIncome = null, statementExpenses = null, startBalance = null, endBalance = null, vatSummary = null, period = null, realIncome = null, realSpending = null, validation = null }) {
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
  const [accountantView, setAccountantView]   = useState(false);
  const [showAuditModal, setShowAuditModal]   = useState(false);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [successVisible, setSuccessVisible]       = useState(true);
  const [editingTx, setEditingTx]                 = useState(null); // { idx, merchantKey }
  const [localCategories, setLocalCategories]     = useState({}); // txKey → category
  const [catSaving, setCatSaving]                 = useState(null);

  const { data: session } = useSession();
  const userPlan = session?.user?.plan || 'FREE';

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

  // Auto-dismiss green success banner after 4s
  useEffect(() => {
    if (!validation || demoMode) return;
    const isSuccess = validation.isValid && validation.confidence >= 90 && validation.warnings.length === 0;
    if (!isSuccess) return;
    const t = setTimeout(() => setSuccessVisible(false), 4000);
    return () => clearTimeout(t);
  }, [validation, demoMode]);

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
    const dates = transactions.map((t) => t.date).filter(Boolean);
    if (!dates.length) return null;
    const sorted = [...dates].sort((a, b) => parseDateStr(a) - parseDateStr(b));
    return sorted[0] === sorted[sorted.length - 1]
      ? sorted[0]
      : `${sorted[0]} – ${sorted[sorted.length - 1]}`;
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

  // ── Summary stats — internal transfers excluded from both Money In and Money Out ──
  // Pattern-based detection catches old saved statements where isInternal flag may not be set
  const INTERNAL_TRANSFER_RE = /\bflex\b|\bmonzo\s+flex\b|transfer\s+(from|to)\s+pot|pot\s+transfer|\bsavings?\s+pot\b|saving\s+space|spending\s+space|space\s+transfer|transfer\s+(to|from)\s+space/i;

  const { txIncome, txExpenses, internalCreditTotal, internalDebitTotal, incomeCount, expenseCount } = useMemo(() => {
    let txIncome = 0, txExpenses = 0, internalCreditTotal = 0, internalDebitTotal = 0;
    let incomeCount = 0, expenseCount = 0;
    for (const t of transactions) {
      if (t.exclude) continue;
      const isInt = t.isInternal || INTERNAL_TRANSFER_RE.test(t.description || "");
      if (t.amount > 0) {
        if (isInt) internalCreditTotal += t.amount;
        else { txIncome += t.amount; incomeCount++; }
      } else {
        if (isInt) internalDebitTotal += Math.abs(t.amount);
        else { txExpenses += Math.abs(t.amount); expenseCount++; }
      }
    }
    return { txIncome, txExpenses, internalCreditTotal, internalDebitTotal, incomeCount, expenseCount };
  }, [transactions]);

  // Always use transaction-computed clean values so internal transfers are excluded from both cards
  const income   = txIncome;
  const expenses = txExpenses;
  const net      = (endBalance !== null) ? endBalance : income - expenses;

  // ── Net balance liquidity gauge ──
  const netGauge = useMemo(() => {
    const limit = overdraftLimit || 200;
    if (net < 0) {
      const overdraftUsed = Math.abs(net);
      const pct = Math.min(100, (overdraftUsed / limit) * 100);
      const remaining = Math.max(0, limit - overdraftUsed);
      return {
        pct,
        color: "#ef4444",
        label: `${fmt(overdraftUsed)} overdrawn · ${fmt(remaining)} remaining`,
      };
    }
    if (net < 500) {
      const pct = Math.min(100, (net / 500) * 100);
      return { pct, color: "#f59e0b", label: `${fmt(net)} available · low buffer` };
    }
    return { pct: 100, color: "#22c55e", label: `${fmt(net)} positive balance` };
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
        body: JSON.stringify({ transactions, realIncome, realSpending, vatSummary, bankName }),
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

  // ── Export CSV (professional accounting format) ──
  const handleCSV = useCallback(() => {
    if (demoMode) { showDemoToast(); return; }

    const taxCategoryMap = {
      "Groceries":                "Subsistence",
      "Eating Out":               "Subsistence",
      "Travel & Transport":       "Travel",
      "Online Shopping":          "Office/Admin",
      "High Street":              "Retail",
      "Direct Debits":            "Overheads",
      "Household Bills":          "Overheads",
      "Health & Fitness":         "Wellbeing",
      "Entertainment & Leisure":  "Entertainment",
      "Charity":                  "Charitable Donation",
      "Cash & ATM":               "Cash",
      "Transfers Sent":           "Internal Transfer",
      "Transfers Received":       "Internal Transfer",
      "Refunds":                  "Reversal",
      "Finance & Bills":          "Finance",
      "Rent & Mortgage":          "Property",
      "Subscriptions & Streaming":"Subscriptions",
      "Uncategorised":            "Uncategorised",
    };

    const headers = [
      "Date","Date (YYYY-MM-DD)","Original Description","Clean Merchant",
      "Via Processor","Category","Tax Category","Type",
      "Debit (£)","Credit (£)","VAT Reclaimable","Est. VAT (£)",
      "VAT Confidence","Is Adjustment","Balance",
    ];

    const rows = transactions.map(tx => [
      tx.date || "",
      tx.dateFormatted || "",
      `"${(tx.description || "").replace(/"/g, '""')}"`,
      `"${(tx.cleanMerchant || tx.description || "").replace(/"/g, '""')}"`,
      tx.viaProcessor || "",
      tx.category || "",
      taxCategoryMap[tx.category] || "Uncategorised",
      tx.transactionType || "Transaction",
      tx.debit  != null ? Math.abs(tx.debit).toFixed(2)  : "",
      tx.credit != null ? Math.abs(tx.credit).toFixed(2) : "",
      tx.vatReclaimable ? "Yes" : "No",
      tx.vatAmount != null ? tx.vatAmount.toFixed(2) : "0.00",
      tx.vatConfidence || "",
      tx.isAdjustment ? "Yes" : "No",
      tx.balance != null ? tx.balance.toFixed(2) : "",
    ]);

    const periodStr = period
      ? (period.from && period.to ? `${period.from} – ${period.to}` : (period.to || ""))
      : (dateRange || "");

    const csvContent = [
      ["StatementFlow Export"],
      [`Bank: ${bankName || "Unknown"}`],
      [`Period: ${periodStr || "Unknown"}`],
      [`Generated: ${new Date().toLocaleDateString("en-GB")}`],
      [`Real Income (excl. transfers): £${realIncome != null ? realIncome.toFixed(2) : "0.00"}`],
      [`Real Spending (excl. transfers): £${realSpending != null ? realSpending.toFixed(2) : "0.00"}`],
      [],
      headers,
      ...rows,
    ]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `StatementFlow_${bankName || "export"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transactions, demoMode, showDemoToast, bankName, period, dateRange, realIncome, realSpending]);

  // ── Print PDF report ──
  const handlePrintReport = useCallback(() => {
    if (demoMode) { showDemoToast(); return; }
    const periodStr = period
      ? (period.from && period.to ? `${period.from} – ${period.to}` : (period.to || ""))
      : (dateRange || "");
    const bankStr = (bank && bank !== "ai-parsed") ? bank : (bankName || "Your Bank");
    document.title = `StatementFlow Report - ${bankStr} - ${periodStr}`;
    setAccountantView(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = "StatementFlow – Bank Statement Converter"; }, 2000);
    }, 500);
  }, [demoMode, showDemoToast, period, dateRange, bankName, bank]);

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

  // Exclude transfer categories from the spending donut — they live in the Transfers In & Out card
  const spendingOnlyBreakdown = useMemo(() =>
    categoryBreakdown.filter(c => !TRANSFER_CATS.has(c.name)),
  [categoryBreakdown]);

  const spendingOnlyTotal = useMemo(() =>
    spendingOnlyBreakdown.reduce((s, c) => s + c.total, 0),
  [spendingOnlyBreakdown]);

  const pieData = useMemo(() =>
    spendingOnlyBreakdown.map((c) => ({ name: c.name, value: c.total, fill: catHex(c.name) })),
  [spendingOnlyBreakdown]);

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
      .filter(({ name }) => {
        if (/^(Mr|Mrs|Ms|Dr|Miss)\s/i.test(name)) return false;
        if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(name)) return false;
        if (name.toLowerCase().includes('kasam')) return false;
        return true;
      })
      .sort((a, b) => b.expense - a.expense)
      .slice(0, 8);
  }, [transactions]);

  // Transfers totals — computed directly from transactions so credits are included
  const transferStats = useMemo(() => {
    let sentAmt = 0, sentCnt = 0, recvAmt = 0, recvCnt = 0;
    for (const tx of transactions) {
      if (tx.excludeFromTotals) continue;
      if (tx.category === "Transfers Sent") {
        sentAmt += Math.abs(tx.amount);
        sentCnt++;
      } else if (tx.category === "Transfers Received") {
        recvAmt += Math.abs(tx.amount);
        recvCnt++;
      }
    }
    return { sentAmt, sentCnt, recvAmt, recvCnt, net: recvAmt - sentAmt };
  }, [transactions]);

  // Build display categories: merge Transfers Sent + Received into one entry
  const displayBreakdown = useMemo(() => {
    const sent     = categoryBreakdown.find(c => c.name === "Transfers Sent");
    const received = categoryBreakdown.find(c => c.name === "Transfers Received");
    const rest     = categoryBreakdown.filter(c => c.name !== "Transfers Sent" && c.name !== "Transfers Received");
    const combined = (sent || received)
      ? [{
          name:  "__TRANSFERS__",
          label: "Transfers In & Out",
          total: (sent?.total ?? 0) + (received?.total ?? 0),
          count: (sent?.count ?? 0) + (received?.count ?? 0),
          sent,
          received,
        }]
      : [];
    return [...rest, ...combined];
  }, [categoryBreakdown]);

  const allCategories = [
    "All",
    ...categoryBreakdown
      .filter(c => c.name !== "Transfers Sent" && c.name !== "Transfers Received")
      .map(c => c.name),
    ...(displayBreakdown.find(c => c.name === "__TRANSFERS__") ? ["Transfers In & Out"] : []),
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const matchSearch =
        t.description.toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q) ||
        String(Math.abs(t.amount)).includes(q) ||
        (t.category || "").toLowerCase().includes(q);
      const matchCat  = filterCat === "All"
        || filterCat === "__TRANSFERS__"
          ? (filterCat === "__TRANSFERS__"
              ? (t.category === "Transfers Sent" || t.category === "Transfers Received")
              : true)
          : t.category === filterCat;
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

  function setFilter(cat) {
    triggerRowAnim();
    setFilterCat(cat === "Transfers In & Out" ? "__TRANSFERS__" : cat);
    setPage(1);
  }

  const loadedTime = loadedAt.current.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Fade-in helper for non-card sections
  function sectionStyle(delay) {
    return {
      opacity:    loaded ? 1 : 0,
      transform:  loaded ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
    };
  }

  const periodStr = period
    ? (period.from && period.to ? `${period.from} – ${period.to}` : (period.to || dateRange || ""))
    : (dateRange || "");
  const bankStr = (bank && bank !== "ai-parsed") ? bank : (bankName || "Your Bank");
  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6" style={{ transition: "background 0.4s ease", background: "#080C14", borderRadius: 20, padding: accountantView ? "0 0 24px" : undefined, paddingTop: 16 }}>

      {showAuditModal && <UpgradeModal feature="audit" onClose={() => setShowAuditModal(false)} />}

      {/* ── GUEST BANNER ── */}
      {!session && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
          background: "rgba(201,168,76,0.08)",
          borderBottom: "1px solid rgba(201,168,76,0.15)",
          borderRadius: 10, padding: "12px 20px", marginBottom: 20,
        }}>
          <p style={{ margin: 0, color: "#C9A84C", fontSize: "0.85rem", fontWeight: 500 }}>
            💾 Your results won't be saved — sign up free to keep your statement history
          </p>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a href="/register" style={{
              background: "linear-gradient(135deg,#C9A84C,#E8C97A)", color: "#080C14",
              fontWeight: 700, fontSize: "0.78rem", padding: "6px 14px",
              borderRadius: 999, textDecoration: "none",
            }}>
              Create Account
            </a>
            <a href="/login" style={{
              background: "transparent", border: "1px solid rgba(201,168,76,0.35)",
              color: "#C9A84C", fontWeight: 600, fontSize: "0.78rem", padding: "6px 14px",
              borderRadius: 999, textDecoration: "none",
            }}>
              Log In
            </a>
          </div>
        </div>
      )}

      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          nav, .navbar { display: none !important; }
          .export-toolbar-inner { display: none !important; }
          .view-toggle { display: none !important; }
          .stat-cards { display: none !important; }
          .your-money-explained { display: none !important; }
          .spending-breakdown { display: none !important; }
          .category-grid { display: none !important; }
          .transaction-table-section { display: none !important; }
          .no-print { display: none !important; }
          .print-report { display: none !important; }
          body { background: #080C14 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 20mm; }
          .print-header { display: block !important; }
          .accountant-panel { display: block !important; }
          .pl-card { page-break-after: always; }
        }
        .print-header { display: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── PRINT HEADER (hidden on screen, shown when printing) ── */}
      <div className="print-header" style={{ display: "none" }}>
        <h1 style={{ color: "#C9A84C", fontSize: "24px", margin: 0, fontWeight: 900 }}>StatementFlow</h1>
        <h2 style={{ fontSize: "18px", margin: "8px 0", fontWeight: 700, color: "#F5F0E8" }}>Financial Statement Report</h2>
        <p style={{ color: "#8A9BB5", margin: "4px 0" }}>{bankStr} · {periodStr || "—"}</p>
        <p style={{ color: "#8A9BB5", margin: "4px 0" }}>Prepared: {todayStr}</p>
        <p style={{ color: "#999", fontSize: "12px", margin: "8px 0 0 0" }}>Generated by StatementFlow · statementflow.app</p>
      </div>

      {/* ── PARSE QUALITY REPORT BANNER ── */}
      {!demoMode && validation && (() => {
        const { isValid, confidence: conf, errors, warnings: warns } = validation;
        const hasErrors   = errors.length > 0;
        const hasWarnings = warns.length > 0;
        const isSuccess   = isValid && !hasWarnings && conf > 85;
        const isDismissed = warningsDismissed && !hasErrors;

        if (isDismissed) return null;
        if (isSuccess && !successVisible) return null;

        const accentColor = hasErrors ? "#EF4444" : hasWarnings ? "#F59E0B" : "#00D4A0";
        const confPillBg  = conf >= 90 ? "rgba(0,212,160,0.15)" : conf >= 70 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)";
        const confPillClr = conf >= 90 ? "#00D4A0" : conf >= 70 ? "#F59E0B" : "#EF4444";
        const title       = hasErrors
          ? "⚠ Issues detected with this statement"
          : hasWarnings
          ? "Parse Quality Report"
          : "✓ Statement successfully read";
        const items       = hasErrors ? errors : hasWarnings ? warns : null;

        return (
          <div style={{
            background: "#0F1521",
            border: `1px solid #2A3A52`,
            borderLeft: `4px solid ${accentColor}`,
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
            opacity: (isSuccess && successVisible) ? 1 : 1,
            transition: "opacity 0.6s ease",
          }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, color: "#F0F4FF", fontSize: "0.9rem", flex: 1 }}>{title}</span>
              {typeof conf === "number" && (
                <span style={{ background: confPillBg, color: confPillClr, fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                  {conf}% confidence
                </span>
              )}
              {(hasWarnings || isSuccess) && (
                <button
                  onClick={() => { setWarningsDismissed(true); if (isSuccess) setSuccessVisible(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5568", fontSize: "1rem", lineHeight: 1, padding: "0 0 0 10px", flexShrink: 0 }}
                  aria-label="Dismiss"
                >✕</button>
              )}
            </div>

            {/* Success sub-text */}
            {isSuccess && (
              <p style={{ margin: "6px 0 0", color: "#8A9BB5", fontSize: "0.82rem" }}>
                {transactions.length} transactions extracted · No issues detected
              </p>
            )}

            {/* Divider + items */}
            {items && items.length > 0 && (
              <>
                <div style={{ height: 1, background: "#1E2A3A", margin: "14px 0 12px" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: accentColor, fontSize: "0.8rem", flexShrink: 0, marginTop: 1 }}>›</span>
                      <span style={{ color: "#8A9BB5", fontSize: "0.82rem", lineHeight: 1.5 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── DEMO TOAST ── */}
      {demoToast && (
        <div
          style={{
            position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, background: "#0D1117", color: "#F5F0E8", border: "1px solid rgba(201,168,76,0.3)",
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

      {/* ── STATEMENT HEADING ── */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#F5F0E8", letterSpacing: "-0.02em" }}>
          {demoMode ? "Example Statement" : "Your Statement"}
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#8A9BB5" }}>
          {dateRange ?? ""}
          {(bank && bank !== "ai-parsed") ? ` · ${bank}` : bankName ? ` · ${bankName}` : ""}
          {!demoMode && validation && typeof validation.confidence === "number" && (
            <span style={{ marginLeft: 6, color: "#4A5568" }}>· Parsed with {validation.confidence}% confidence</span>
          )}
        </p>
      </div>

      {/* ── EXPORT TOOLBAR ── */}
      <ExportToolbar downloading={downloading} onDownload={handleDownload} onCSV={handleCSV} onPrint={handlePrintReport} downloadError={downloadError} isGuest={!session} />

      {/* ── STAT CARDS ── */}
      <div ref={demoRef} className="stat-cards grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-5">
        <StatCard
          label="Total Money In"
          value={fmt(income)}
          sub={
            internalCreditTotal > 0
              ? `Excl. ${fmt(internalCreditTotal)} internal transfers`
              : `${incomeCount} credit${incomeCount !== 1 ? "s" : ""}`
          }
          gradient="linear-gradient(135deg, #061a10 0%, #0a2918 100%)"
          border="1px solid rgba(0,212,160,0.25)"
          shadow="0 0 40px rgba(0,212,160,0.06), inset 0 1px 0 rgba(0,212,160,0.1)"
          numColor="#00D4A0"
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
            internalDebitTotal > 0
              ? `Excl. ${fmt(internalDebitTotal)} internal transfers`
              : `${expenseCount} debit${expenseCount !== 1 ? "s" : ""}`
          }
          gradient="linear-gradient(135deg, #1a0606 0%, #290a0a 100%)"
          border="1px solid rgba(239,68,68,0.25)"
          shadow="0 0 40px rgba(239,68,68,0.06), inset 0 1px 0 rgba(239,68,68,0.1)"
          numColor="#EF4444"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 13l-5 5m0 0l-5-5m5 5V6" /></svg>}
          loaded={loaded}
          delay={200}
          countTarget={expenses}
          countTriggered={demoMode ? demoTriggered : loaded}
          countFormat={(v) => fmt(v)}
        />
        <StatCard
          label="Transactions"
          value={`${transactions.length}`}
          sub={`${incomeCount} in · ${expenseCount} out`}
          gradient="linear-gradient(135deg, #0a0d1a 0%, #0d1122 100%)"
          border="1px solid rgba(99,102,241,0.25)"
          shadow="0 0 40px rgba(99,102,241,0.06), inset 0 1px 0 rgba(99,102,241,0.1)"
          numColor="#818CF8"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          loaded={loaded}
          delay={400}
          countTarget={transactions.length}
          countTriggered={demoMode ? demoTriggered : loaded}
          countFormat={(v) => Math.round(v).toString()}
        />
      </div>

      {/* ── VIEW TOGGLE ── */}
      <div className="view-toggle view-toggle-full" style={{ background: "#0D1117", borderRadius: "999px", padding: "4px", position: "relative", cursor: "pointer", border: "1px solid #1E2A3A" }}>
        {/* Sliding pill */}
        <div style={{
          position: "absolute",
          top: "4px",
          bottom: "4px",
          width: "calc(50% - 4px)",
          background: accountantView ? "linear-gradient(135deg, #C9A84C, #E8C97A)" : "rgba(201,168,76,0.05)",
          borderRadius: "999px",
          boxShadow: accountantView ? "0 2px 8px rgba(201,168,76,0.4)" : "none",
          borderBottom: accountantView ? "none" : "2px solid #C9A84C",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, box-shadow 0.3s ease",
          transform: accountantView ? "translateX(calc(100% + 4px))" : "translateX(0)",
        }} />
        <div onClick={() => setAccountantView(false)} style={{ position: "relative", zIndex: 1, padding: "8px 24px", borderRadius: "999px", fontSize: "0.875rem", fontWeight: accountantView ? 400 : 600, color: accountantView ? "#8A9BB5" : "#C9A84C", transition: "color 0.3s ease", userSelect: "none" }}>
          👤 Personal
        </div>
        <div
          onClick={() => { if (userPlan === 'FREE') setShowAuditModal(true); else setAccountantView(true); }}
          style={{ position: "relative", zIndex: 1, padding: "8px 24px", borderRadius: "999px", fontSize: "0.875rem", fontWeight: accountantView ? 600 : 400, color: accountantView ? "#080C14" : "#8A9BB5", transition: "color 0.3s ease", userSelect: "none" }}
        >
          📊 Audit-Ready{!session ? ' 🔒' : ''}
        </div>
      </div>

      <div key={accountantView ? "accountant" : "personal"} style={{ animation: "fadeIn 0.3s ease" }}>
        {/* ── UNIFIED FINANCIAL SUMMARY ── */}
        {!accountantView && transactions.length > 0 && (
          <div className="your-money-explained"><FinancialSummary
            transactions={transactions}
            income={income}
            expenses={expenses}
            net={net}
            categoryBreakdown={categoryBreakdown}
            dateRange={dateRange}
            insights={insights}
            onWeekClick={handleWeekClick}
            activeWeek={weekFilter}
          /></div>
        )}

        {/* ── ACCOUNTANT VIEW: P&L + VAT ── */}
        {accountantView && (
          <AccountantView
            transactions={transactions}
            income={income}
            expenses={expenses}
            net={net}
            categoryBreakdown={categoryBreakdown}
            vatSummary={vatSummary}
            dateRange={dateRange}
            period={period}
            bank={bank}
            bankName={bankName}
            reversalsCount={reversalsCount}
          />
        )}
      </div>

      {/* ── CHARTS ── */}
      <div ref={chartsRef} className="spending-breakdown grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ ...sectionStyle(350), borderTop: "1px solid #1E2A3A", paddingTop: 24 }}>

        {/* Donut chart */}
        <div style={{ background: "#0D1117", borderRadius: 16, border: "1px solid #1E2A3A", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24 }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", margin: 0 }}>Spending Breakdown</h3>
          <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginTop: 2, marginBottom: 16 }}>Expenses by category</p>
          {pieData.length === 0 ? (
            <div style={{ height: 192, display: "flex", alignItems: "center", justifyContent: "center", color: "#8A9BB5", fontSize: "0.875rem" }}>No expense data</div>
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
                              <circle cx={cx} cy={cy} r={58} fill="#080C14" />
                              <text x={cx} y={cy - 8} textAnchor="middle" fill="#8A9BB5" fontSize={10} fontFamily="inherit">Net</text>
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
                <PieLegend data={pieData} totalExpenses={spendingOnlyTotal || expenses} />
              </div>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div style={{ background: "#0D1117", borderRadius: 16, border: "1px solid #1E2A3A", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24 }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", margin: 0 }}>Top Merchants</h3>
          <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginTop: 2, marginBottom: 16 }}>Top 8 by total spend</p>
          {barData.length === 0 ? (
            <div style={{ height: 192, display: "flex", alignItems: "center", justifyContent: "center", color: "#8A9BB5", fontSize: "0.875rem" }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="goldBarGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#C9A84C" />
                    <stop offset="100%" stopColor="#E8C97A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1E2A3A" />
                <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "#8A9BB5" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category" dataKey="name" width={110}
                  tick={{ fontSize: 11, fill: "#F5F0E8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                />
                <ReTooltip content={<BarTooltip />} cursor={{ fill: "rgba(201,168,76,0.05)" }} />
                <Bar dataKey="expense" name="Expense" fill="url(#goldBarGrad)" radius={[0, 6, 6, 0]} maxBarSize={16} isAnimationActive={demoMode ? chartsTriggered : true} animationDuration={800} />
                <Bar dataKey="income"  name="Income"  fill="#00D4A0" radius={[0, 6, 6, 0]} maxBarSize={16} isAnimationActive={demoMode ? chartsTriggered : true} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── CATEGORY BREAKDOWN ── */}
      <div
        className="category-grid"
        style={{ ...sectionStyle(450), borderRadius: 16, background: "#0D1117", border: "1px solid #1E2A3A", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", padding: 24, marginTop: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", margin: 0 }}>Spending by Category</h3>
            <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginTop: 2 }}>Click a category to filter the transaction table</p>
          </div>
          {filterCat !== "All" && (
            <button
              onClick={() => setFilter("All")}
              style={{ fontSize: "0.75rem", fontWeight: 600, color: "#C9A84C", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", padding: "6px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.2s ease" }}
            >
              ✕ Clear filter ({filterCat === "__TRANSFERS__" ? "Transfers In & Out" : filterCat})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayBreakdown.map((entry, idx) => {
            const isTransferCard = entry.name === "__TRANSFERS__";

            if (isTransferCard) {
              const isActive  = filterCat === "__TRANSFERS__";
              const { sentAmt, sentCnt, recvAmt, recvCnt, net: netXfer } = transferStats;
              return (
                <button
                  key="__TRANSFERS__"
                  onClick={() => setFilter(isActive ? "All" : "Transfers In & Out")}
                  className="group relative text-left"
                  style={{ borderRadius: 12, padding: 16, background: "#0D1117", border: isActive ? "1px solid rgba(201,168,76,0.5)" : "1px solid #1E2A3A", transition: "all 0.2s ease", cursor: "pointer", boxShadow: isActive ? "0 0 0 2px rgba(201,168,76,0.2)" : "none" }}
                >
                  <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 4, borderRadius: "0 4px 4px 0", backgroundColor: "#C9A84C" }} />
                  <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: "1.05rem" }}>🔄</span>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#F5F0E8", margin: 0 }}>Transfers In &amp; Out</p>
                    </div>
                    {/* Sent row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.78rem", color: "#8A9BB5" }}>↑ Sent</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#EF4444" }}>{fmt(sentAmt)}</span>
                        <span style={{ fontSize: "0.7rem", color: "#8A9BB5", marginLeft: 4 }}>{sentCnt} txn{sentCnt !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {/* Received row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.78rem", color: "#8A9BB5" }}>↓ Received</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#00D4A0" }}>{fmt(recvAmt)}</span>
                        <span style={{ fontSize: "0.7rem", color: "#8A9BB5", marginLeft: 4 }}>{recvCnt} txn{recvCnt !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {/* Net */}
                    <div style={{ borderTop: "1px solid #1E2A3A", paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.75rem", color: "#8A9BB5", fontWeight: 600 }}>Net</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: netXfer >= 0 ? "#00D4A0" : "#EF4444" }}>
                        {netXfer >= 0 ? "+" : ""}{fmt(netXfer)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            }

            const { name, total, count } = entry;
            const hex      = catHex(name);
            const pctBase  = TRANSFER_CATS.has(name) ? (expenses || 1) : (spendingOnlyTotal || expenses || 1);
            const pct      = pctBase > 0 ? (total / pctBase) * 100 : 0;
            const isActive = filterCat === name;
            const tip      = CAT_TIPS[name] ?? "Transactions in this category";

            return (
              <button
                key={name}
                onClick={() => setFilter(isActive ? "All" : name)}
                className="group relative text-left"
                style={{ borderRadius: 12, padding: 20, background: "#0D1117", border: isActive ? "1px solid rgba(201,168,76,0.5)" : "1px solid #1E2A3A", transition: "all 0.2s ease", cursor: "pointer", boxShadow: isActive ? "0 0 0 2px rgba(201,168,76,0.2)" : "none" }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "#1E2A3A"; e.currentTarget.style.transform = "translateY(0)"; } }}
              >
                <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 4, borderRadius: "0 4px 4px 0", backgroundColor: hex }} />
                <div style={{ paddingLeft: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{catEmoji(name)}</span>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#F5F0E8", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <div className="relative">
                        <span style={{ color: "#4A5568", fontSize: "0.75rem", cursor: "default" }} onClick={(e) => e.stopPropagation()}>ℹ</span>
                        <div
                          className="pointer-events-none absolute z-20 bottom-full right-0 mb-2 w-48 rounded-lg px-3 py-2 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          style={{ transform: "translateX(20%)", background: "#111820", border: "1px solid #1E2A3A" }}
                        >
                          {tip}
                          <div style={{ position: "absolute", top: "100%", right: 16, borderWidth: 4, borderStyle: "solid", borderColor: "transparent", borderTopColor: "#111820" }} />
                        </div>
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff", backgroundColor: hex, borderRadius: 999, padding: "2px 6px", minWidth: "2.8rem", textAlign: "center" }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#F5F0E8", lineHeight: 1, marginBottom: 8 }}>{fmt(total)}</p>
                  <p style={{ fontSize: "0.75rem", color: "#8A9BB5", marginBottom: 10 }}>{count} transaction{count !== 1 ? "s" : ""}</p>
                  <div style={{ height: 3, background: "#1E2A3A", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width:  barsVisible ? `${Math.min(pct, 100)}%` : "0%",
                        background: "linear-gradient(90deg, #C9A84C, #E8C97A)",
                        borderRadius: 999,
                        transition: `width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 55}ms`,
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
      <div ref={txTableRef} className="transaction-table-section" style={sectionStyle(550)}>
        {/* Collapse toggle */}
        <div className="tx-toggle-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 20, marginBottom: txExpanded ? 12 : 0 }}>
          <button
            onClick={() => setTxExpanded(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: txExpanded ? "linear-gradient(135deg, #C9A84C, #E8C97A, #C9A84C)" : "#0D1117",
              color: txExpanded ? "#080C14" : "#F5F0E8",
              fontWeight: 700, fontSize: "0.95rem",
              padding: "11px 20px", borderRadius: 50, border: txExpanded ? "none" : "1px solid #1E2A3A",
              cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: txExpanded ? "0 8px 30px rgba(201,168,76,0.45)" : "none",
            }}
          >
            <span>{txExpanded ? "▲" : "📋"}</span>
            <span>{txExpanded ? "Hide Transactions" : `View Transactions (${transactions.length})`}</span>
          </button>
          {!txExpanded && (
            <span style={{ fontSize: "0.78rem", color: "#8A9BB5" }}>Full list available in your Excel export</span>
          )}
        </div>

        {/* Week filter pill (Upgrade 2) */}
        {weekFilter !== null && weekRanges && (
          <div style={{ marginTop: 10, marginBottom: 2 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(201,168,76,0.15)", color: "#C9A84C", padding: "6px 14px", borderRadius: 20, fontSize: "0.8rem", fontWeight: 600, border: "1px solid rgba(201,168,76,0.3)" }}>
              📅 Showing Week {weekFilter + 1} ({weekRanges[weekFilter].label})
              <button
                onClick={() => { setWeekFilter(null); setPage(1); }}
                style={{ background: "none", border: "none", color: "rgba(201,168,76,0.7)", cursor: "pointer", padding: 0, fontSize: "1rem", lineHeight: 1, fontWeight: 700 }}
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
        style={{ background: "#0D1117", borderRadius: 16, border: "1px solid #1E2A3A", boxShadow: "0 4px 24px rgba(0,0,0,0.3)", overflow: "hidden" }}
      >
        {/* Filter bar */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1E2A3A", display: "flex", flexDirection: "column", gap: 12, background: "#0D1117" }} className="sm:flex-row sm:items-center flex-wrap">
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#F5F0E8", margin: 0 }}>
              Transactions
              {filterCat !== "All" && (
                <span style={{ marginLeft: 8, fontSize: "0.875rem", fontWeight: 400, color: "#8A9BB5" }}>· filtered by {filterCat === "__TRANSFERS__" ? "Transfers In & Out" : filterCat}</span>
              )}
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#8A9BB5", margin: "2px 0 0" }}>{sorted.length} result{sorted.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            {/* Search */}
            <div className="relative">
              <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#4A5568" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search transactions…"
                value={search}
                onChange={(e) => { const v = e.target.value; triggerRowAnim(); setSearch(v); setPage(1); }}
                style={{ paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: "0.875rem", border: "1px solid #1E2A3A", borderRadius: 12, background: "#111820", color: "#F5F0E8", outline: "none", width: 176 }}
              />
            </div>
            {/* Category filter */}
            <select
              value={filterCat === "__TRANSFERS__" ? "Transfers In & Out" : filterCat}
              onChange={(e) => { const v = e.target.value; setFilter(v); }}
              style={{ fontSize: "0.875rem", border: "1px solid #1E2A3A", borderRadius: 12, padding: "8px 12px", background: "#111820", color: "#F5F0E8", outline: "none" }}
            >
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Type filter */}
            <select
              value={filterType}
              onChange={(e) => { const v = e.target.value; triggerRowAnim(); setFilterType(v); setPage(1); }}
              style={{ fontSize: "0.875rem", border: "1px solid #1E2A3A", borderRadius: 12, padding: "8px 12px", background: "#111820", color: "#F5F0E8", outline: "none" }}
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
              <tr style={{ background: "#111820", borderBottom: "2px solid #1E2A3A", color: "#8A9BB5", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 700, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => toggleSort("date")}>
                  Date <SortIcon col="date" />
                </th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 700, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("description")}>
                  Description <SortIcon col="description" />
                </th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 700, cursor: "pointer", userSelect: "none" }} className="tx-col-category" onClick={() => toggleSort("category")}>
                  Category <SortIcon col="category" />
                </th>
                <th style={{ padding: "14px 20px", textAlign: "right", fontWeight: 700, cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("amount")}>
                  Amount <SortIcon col="amount" />
                </th>
              </tr>
            </thead>
            <tbody style={{ opacity: rowsHiding ? 0 : 1, transition: "opacity 0.15s ease" }}>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "56px 20px", textAlign: "center", color: "#8A9BB5" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "1.875rem" }}>🔍</span>
                      <p style={{ fontWeight: 500, margin: 0 }}>No transactions match your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((t, i) => {
                  const isIncome = t.amount >= 0;
                  const rowBg    = i % 2 === 0 ? "#0D1117" : "#111820";
                  const txKey    = `${t.date}||${t.description}||${t.amount}`;
                  const displayCat = localCategories[txKey] || t.category || UNKNOWN_CAT;
                  const hex      = catHex(displayCat);
                  return (
                    <tr
                      key={`${rowFadeKey}-${i}`}
                      style={{
                        background: rowBg,
                        borderBottom: "1px solid rgba(30,42,58,0.5)",
                        animation: `rowFadeIn 0.3s ease forwards ${Math.min(i, 14) * 30}ms`,
                        opacity: 0,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#111820"}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}
                    >
                      {/* Date cell with coloured left border */}
                      <td
                        style={{
                          padding: "14px 20px",
                          color: "#8A9BB5",
                          whiteSpace: "nowrap",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          borderLeft: `3px solid ${hex}`,
                        }}
                      >
                        {t.date}
                      </td>
                      {/* Description with coloured category dot */}
                      <td style={{ padding: "14px 20px", color: "#F5F0E8", fontWeight: 500, maxWidth: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: hex }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{t.description}</span>
                          {subscriptionMerchants.has(t.description) && (
                            <span title="Recurring transaction" style={{ fontSize: "0.7rem", flexShrink: 0, opacity: 0.75 }}>🔄</span>
                          )}
                        </div>
                      </td>
                      {/* Category badge + edit */}
                      <td style={{ padding: "14px 20px" }} className="tx-col-category">
                        {editingTx === txKey ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <select
                              autoFocus
                              defaultValue={displayCat}
                              disabled={catSaving === txKey}
                              style={{ fontSize: "0.78rem", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 8, padding: "3px 6px", color: "#F5F0E8", background: "#111820", cursor: "pointer" }}
                              onChange={async (e) => {
                                const newCat = e.target.value;
                                setCatSaving(txKey);
                                setLocalCategories(prev => ({ ...prev, [txKey]: newCat }));
                                setEditingTx(null);
                                try {
                                  await fetch("/api/transactions/categorise", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ merchantKey: t.merchantKey || txKey, newCategory: newCat }),
                                  });
                                } catch (_) {}
                                setCatSaving(null);
                              }}
                              onBlur={() => setEditingTx(null)}
                            >
                              {Object.keys(CAT_CONFIG).map(c => (
                                <option key={c} value={c}>{catEmoji(c)} {c}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CategoryBadge name={displayCat} />
                            {!demoMode && (
                              <button
                                onClick={() => setEditingTx(txKey)}
                                title="Change category"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#4A5568", fontSize: "0.8rem", padding: "2px 4px", borderRadius: 4, lineHeight: 1, flexShrink: 0 }}
                                onMouseEnter={e => e.currentTarget.style.color = "#C9A84C"}
                                onMouseLeave={e => e.currentTarget.style.color = "#4A5568"}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Amount */}
                      <td style={{ padding: "14px 20px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontSize: "0.95rem", color: isIncome ? "#00D4A0" : "#EF4444" }}>
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
          <div style={{ padding: "16px 24px", borderTop: "1px solid #1E2A3A", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.875rem", color: "#8A9BB5", background: "#111820" }}>
            <span style={{ fontSize: "0.75rem", color: "#8A9BB5" }}>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #1E2A3A", background: "#0D1117", color: "#8A9BB5", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1, fontSize: "0.75rem", fontWeight: 500, transition: "all 0.15s ease" }}
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
                    style={{
                      width: 32, height: 32, borderRadius: 8, fontSize: "0.75rem", fontWeight: 600,
                      border: p === page ? "none" : "1px solid #1E2A3A",
                      background: p === page ? "#C9A84C" : "#0D1117",
                      color: p === page ? "#080C14" : "#8A9BB5",
                      cursor: "pointer", transition: "all 0.15s ease",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #1E2A3A", background: "#0D1117", color: "#8A9BB5", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1, fontSize: "0.75rem", fontWeight: 500, transition: "all 0.15s ease" }}
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
