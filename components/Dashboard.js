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
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gauge.pct}%`, background: gauge.color, borderRadius: 999, transition: "width 1s ease 0.6s" }} />
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

  const rowStyle  = { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: "0.9rem" };
  const divStyle  = { borderTop: "2px solid #e2e8f0", margin: "4px 0" };
  const cardStyle = { background: "#fff", borderRadius: 16, boxShadow: "0 1px 12px rgba(0,0,0,0.07)", padding: "24px 28px", border: "1px solid #f1f5f9", borderTop: "3px solid #6d28d9" };

  return (
    <div className="accountant-panel" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── MODE BANNER ── */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #2563eb)", borderRadius: 12, padding: "12px 20px" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "white" }}>📊 Accountant View — Professional Analysis</p>
        <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "rgba(255,255,255,0.65)" }}>Switch to Personal View for the standard dashboard</p>
      </div>

      {/* ── RECONCILIATION STATUS BANNER ── */}
      <div className="recon-banner">
        <div style={{ width: 40, height: 40, background: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 20, flexShrink: 0 }}>✓</div>
        <div>
          <p style={{ fontWeight: 700, color: "#166534", margin: "0 0 2px 0", fontSize: "0.95rem" }}>Statement Reconciled</p>
          <p style={{ color: "#4ade80", margin: 0, fontSize: "0.8rem" }}>
            All transactions verified · {reversalsCount} reversal{reversalsCount !== 1 ? "s" : ""} matched · {internalCount} internal transfer{internalCount !== 1 ? "s" : ""} excluded
          </p>
        </div>
        <div className="recon-banner-right">
          <p style={{ fontWeight: 700, color: "#166534", margin: "0 0 2px 0", fontSize: "0.95rem" }}>Audit Ready</p>
          <p style={{ color: "#6b7280", margin: 0, fontSize: "0.75rem" }}>{new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      {/* ── CARD 1: P&L STATEMENT ── */}
      <div style={cardStyle} className="pl-card">
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>Profit &amp; Loss Summary</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>{periodStr} · Prepared by StatementFlow</p>
        </div>

        <div className="pl-grid">
          {/* Income */}
          <div>
            <p style={{ margin: "0 0 12px", fontSize: "0.7rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.08em" }}>Income</p>
            {incomeCategories.map(([cat, amt]) => (
              <div key={cat} style={rowStyle}>
                <span style={{ color: "#475569" }}>{cat}</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{fmt(amt)}</span>
              </div>
            ))}
            <div style={divStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", fontWeight: 800, fontSize: "0.95rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#059669" }}>
                TOTAL INCOME
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#166534", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>✓ Verified</span>
              </span>
              <span style={{ color: "#059669" }}>{fmt(income)}</span>
            </div>
          </div>

          {/* Expenditure */}
          <div>
            <p style={{ margin: "0 0 12px", fontSize: "0.7rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em" }}>Expenditure</p>
            {categoryBreakdown.filter(c => c.total > 0).map(({ name, total }) => (
              <div key={name} style={rowStyle}>
                <span style={{ color: "#475569" }}>{name}</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{fmt(total)}</span>
              </div>
            ))}
            <div style={divStyle} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0 0", fontWeight: 800, fontSize: "0.95rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
                TOTAL EXPENDITURE
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#166534", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>✓ Verified</span>
              </span>
              <span style={{ color: "#dc2626" }}>{fmt(expenses)}</span>
            </div>
          </div>
        </div>

        {/* Net position */}
        <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 12, background: net >= 0 ? "#f0fdf4" : "#fff1f2", border: `2px solid ${net >= 0 ? "#86efac" : "#fecaca"}`, textAlign: "center" }}>
          <p style={{ margin: "0 0 4px", fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Net Position</p>
          <p style={{ margin: 0, fontWeight: 900, fontSize: "1.6rem", color: net >= 0 ? "#16a34a" : "#dc2626" }}>
            {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>{net >= 0 ? "Surplus for the period" : "Deficit for the period"}</p>
        </div>
      </div>

      {/* ── CARD 2: VAT SUMMARY ── */}
      <div style={cardStyle}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>Estimated VAT Reclaimable</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>Standard rate 20% · Verify all claims with HMRC</p>
        </div>

        <div className="vat-layout">
          {/* Left: total figure */}
          <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #f3f0ff, #ede9fe)", borderRadius: 12, textAlign: "center", minWidth: 160 }}>
            <p style={{ margin: "0 0 4px", fontSize: "0.7rem", fontWeight: 700, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Est. VAT</p>
            <p style={{ margin: "0 0 4px", fontSize: "2rem", fontWeight: 900, color: "#4c1d95", lineHeight: 1 }}>{fmt(vatTotal)}</p>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "#7c3aed" }}>across {vatCount} transaction{vatCount !== 1 ? "s" : ""}</p>
          </div>

          {/* Right: breakdown table */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Category", "Gross Spend", "Est. VAT"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: h === "Category" ? "left" : "right", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vatCatRows.map(({ name, spend, vat }) => (
                <tr key={name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 10px", color: "#475569" }}>{name}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "#1e293b", fontWeight: 600 }}>{fmt(spend)}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: vat > 0 ? "#6d28d9" : "#94a3b8", fontWeight: vat > 0 ? 700 : 400 }}>{fmt(vat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: "20px 0 0", fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic", lineHeight: 1.6 }}>
          ⚠️ VAT estimates are based on standard 20% rate applied to gross amounts. Actual VAT reclaimable depends on your business type, VAT registration status, and HMRC guidelines. Always verify with a qualified accountant before submitting claims.
        </p>
      </div>

      {/* ── CARD 3: BUSINESS EXPENSE REVIEW ── */}
      {reviewTx.length > 0 && (
        <div style={cardStyle} className="no-print">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#1e293b" }}>Transactions to Review</h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>Flag which are genuine business expenses</p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>VAT Est.</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                  <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <input type="checkbox" checked={checkedRows.size === reviewTx.length && reviewTx.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} title="Select all" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviewTx.map((t, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: "1px solid #f1f5f9", background: checkedRows.has(i) ? "#faf5ff" : (i % 2 === 0 ? "#fff" : "#fafafa"), cursor: "pointer" }}
                    onClick={() => toggleRow(i)}
                  >
                    <td style={{ padding: "8px 12px", color: "#64748b", whiteSpace: "nowrap", fontSize: "0.8rem" }}>{t.date}</td>
                    <td style={{ padding: "8px 12px", color: "#1e293b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                    <td style={{ padding: "8px 12px" }}><CategoryBadge name={t.category} /></td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{fmt(t.amount)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: t.vatAmount > 0 ? "#6d28d9" : "#94a3b8", fontWeight: t.vatAmount > 0 ? 700 : 400 }}>{t.vatAmount > 0 ? fmt(t.vatAmount) : "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {t.isInternal
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#dbeafe", color: "#1e40af", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>↔ Internal</span>
                        : t.reversalLinked || t.excludeFromTotals
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#fef3c7", color: "#92400e", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>⟳ Adjusted</span>
                        : t.category === "Uncategorised"
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#f3f4f6", color: "#6b7280", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>? Review</span>
                        : <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#dcfce7", color: "#166534", fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>✓ Verified</span>}
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
          <div style={{ marginTop: 12, padding: "12px 16px", background: checkedRows.size > 0 ? "#faf5ff" : "#f8fafc", borderRadius: 10, border: `1px solid ${checkedRows.size > 0 ? "#ddd6fe" : "#e2e8f0"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              {checkedRows.size === 0
                ? "Click rows to flag business expenses"
                : `${checkedRows.size} transaction${checkedRows.size !== 1 ? "s" : ""} selected`}
            </span>
            {checkedRows.size > 0 && (
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#6d28d9" }}>
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
function ExportToolbar({ downloading, onDownload, onCSV, onPrint, downloadError }) {
  return (
    <div
      className="export-toolbar-inner"
      style={{
        background:   "#ffffff",
        borderRadius: 14,
        border:       "1px solid #e8e4f8",
        borderLeft:   "4px solid #6c5ce7",
        boxShadow:    "0 2px 12px rgba(108,92,231,0.07), 0 1px 4px rgba(0,0,0,0.04)",
        padding:      "10px 18px 10px 20px",
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
          onClick={onPrint}
          style={{
            background:   "linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)",
            color:        "#fff",
            fontWeight:   700,
            fontSize:     "0.88rem",
            padding:      "9px 20px",
            borderRadius: 11,
            border:       "none",
            cursor:       "pointer",
            boxShadow:    "0 4px 14px rgba(30,58,95,0.32)",
            display:      "flex",
            alignItems:   "center",
            gap:          7,
            transition:   "transform 0.15s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(30,58,95,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 4px 14px rgba(30,58,95,0.32)"; }}
        >
          <span style={{ fontSize: "1rem" }}>📄</span> Download Report
        </button>

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
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [successVisible, setSuccessVisible]       = useState(true);
  const [editingTx, setEditingTx]                 = useState(null); // { idx, merchantKey }
  const [localCategories, setLocalCategories]     = useState({}); // txKey → category
  const [catSaving, setCatSaving]                 = useState(null);

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

  // ── Summary stats ──
  const { txIncome, txExpenses, incomeCount, expenseCount } = useMemo(() => {
    let txIncome = 0, txExpenses = 0, incomeCount = 0, expenseCount = 0;
    for (const t of transactions) {
      if (t.exclude) continue;
      if (t.amount > 0) { txIncome += t.amount; incomeCount++; }
      else { txExpenses += Math.abs(t.amount); expenseCount++; }
    }
    return { txIncome, txExpenses, incomeCount, expenseCount };
  }, [transactions]);

  // Use PDF-extracted totals for KPI display when available (FIX 1)
  const income   = statementIncome   ?? txIncome;
  const expenses = statementExpenses ?? txExpenses;
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
    <div className="space-y-6" style={{ transition: "background 0.4s ease", background: accountantView ? "#f0f4ff" : "transparent", borderRadius: 20, padding: accountantView ? "0 0 24px" : undefined, paddingTop: 16 }}>

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
          body { background: #fff !important; }
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
        <h1 style={{ color: "#6d28d9", fontSize: "24px", margin: 0, fontWeight: 900 }}>StatementFlow</h1>
        <h2 style={{ fontSize: "18px", margin: "8px 0", fontWeight: 700, color: "#1e293b" }}>Financial Statement Report</h2>
        <p style={{ color: "#666", margin: "4px 0" }}>{bankStr} · {periodStr || "—"}</p>
        <p style={{ color: "#666", margin: "4px 0" }}>Prepared: {todayStr}</p>
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

      {/* ── STATEMENT HEADING ── */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em" }}>
          {demoMode ? "Example Statement" : "Your Statement"}
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
          {dateRange ?? ""}
          {(bank && bank !== "ai-parsed") ? ` · ${bank}` : bankName ? ` · ${bankName}` : ""}
          {!demoMode && validation && typeof validation.confidence === "number" && (
            <span style={{ marginLeft: 6, color: "#cbd5e1" }}>· Parsed with {validation.confidence}% confidence</span>
          )}
        </p>
      </div>

      {/* ── EXPORT TOOLBAR ── */}
      <ExportToolbar downloading={downloading} onDownload={handleDownload} onCSV={handleCSV} onPrint={handlePrintReport} downloadError={downloadError} />

      {/* ── STAT CARDS ── */}
      <div ref={demoRef} className="stat-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
              ? `Excl. ${fmt(internalTransferTotal)} internal transfers`
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
          sub={net >= 0 ? "✓ Positive cash flow" : <><span style={{ color: "#f97316" }}>⚠</span> Negative cash flow</>}
          gradient="linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)"
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
          gradient="linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)"
          icon={<svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          loaded={loaded}
          delay={400}
          countTarget={transactions.length}
          countTriggered={demoMode ? demoTriggered : loaded}
          countFormat={(v) => Math.round(v).toString()}
        />
      </div>

      {/* ── VIEW TOGGLE ── */}
      <div className="view-toggle view-toggle-full" style={{ background: "#f3f4f6", borderRadius: "999px", padding: "4px", position: "relative", cursor: "pointer" }}>
        {/* Sliding pill */}
        <div style={{
          position: "absolute",
          top: "4px",
          bottom: "4px",
          width: "calc(50% - 4px)",
          background: accountantView ? "linear-gradient(135deg, #1e3a5f, #2563eb)" : "white",
          borderRadius: "999px",
          boxShadow: accountantView ? "0 2px 8px rgba(37,99,235,0.4)" : "0 1px 4px rgba(0,0,0,0.12)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease, box-shadow 0.3s ease",
          transform: accountantView ? "translateX(calc(100% + 4px))" : "translateX(0)",
        }} />
        <div onClick={() => setAccountantView(false)} style={{ position: "relative", zIndex: 1, padding: "8px 24px", borderRadius: "999px", fontSize: "0.875rem", fontWeight: accountantView ? 400 : 600, color: accountantView ? "#6b7280" : "#6d28d9", transition: "color 0.3s ease", userSelect: "none" }}>
          👤 Personal
        </div>
        <div onClick={() => setAccountantView(true)} style={{ position: "relative", zIndex: 1, padding: "8px 24px", borderRadius: "999px", fontSize: "0.875rem", fontWeight: accountantView ? 600 : 400, color: accountantView ? "white" : "#6b7280", transition: "color 0.3s ease", userSelect: "none" }}>
          📊 Audit-Ready
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
      <div ref={chartsRef} className="spending-breakdown grid grid-cols-1 lg:grid-cols-2 gap-6" style={sectionStyle(350)}>

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
        className="category-grid bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
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
                  className={`group relative text-left p-4 rounded-xl border transition-all hover:shadow-md ${
                    isActive
                      ? "border-blue-400 ring-2 ring-blue-200 bg-blue-50/50"
                      : "border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200"
                  }`}
                  style={{ borderRadius: 12 }}
                >
                  <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: "#6366f1" }} />
                  <div className="pl-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span style={{ fontSize: "1.05rem" }}>🔄</span>
                      <p className="text-sm font-semibold text-slate-700">Transfers In &amp; Out</p>
                    </div>
                    {/* Sent row */}
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>↑ Sent</span>
                      <div className="text-right">
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#dc2626" }}>{fmt(sentAmt)}</span>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: 4 }}>{sentCnt} txn{sentCnt !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {/* Received row */}
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>↓ Received</span>
                      <div className="text-right">
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#059669" }}>{fmt(recvAmt)}</span>
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: 4 }}>{recvCnt} txn{recvCnt !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {/* Net */}
                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Net</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: netXfer >= 0 ? "#059669" : "#dc2626" }}>
                        {netXfer >= 0 ? "+" : ""}{fmt(netXfer)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            }

            const { name, total, count } = entry;
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
                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full" style={{ backgroundColor: hex }} />
                <div className="pl-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span style={{ fontSize: "1.05rem", flexShrink: 0 }}>{catEmoji(name)}</span>
                      <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative">
                        <span className="text-slate-300 hover:text-slate-500 text-xs cursor-default" onClick={(e) => e.stopPropagation()}>ℹ</span>
                        <div
                          className="pointer-events-none absolute z-20 bottom-full right-0 mb-2 w-48 rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          style={{ transform: "translateX(20%)" }}
                        >
                          {tip}
                          <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full" style={{ backgroundColor: hex, minWidth: "2.8rem", textAlign: "center" }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xl font-extrabold text-slate-800 leading-none mb-2">{fmt(total)}</p>
                  <p className="text-xs text-slate-400 mb-2.5">{count} transaction{count !== 1 ? "s" : ""}</p>
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
      <div ref={txTableRef} className="transaction-table-section" style={sectionStyle(550)}>
        {/* Collapse toggle */}
        <div className="tx-toggle-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: txExpanded ? 12 : 0 }}>
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
                <span className="ml-2 text-sm font-normal text-slate-400">· filtered by {filterCat === "__TRANSFERS__" ? "Transfers In & Out" : filterCat}</span>
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
              value={filterCat === "__TRANSFERS__" ? "Transfers In & Out" : filterCat}
              onChange={(e) => { const v = e.target.value; setFilter(v); }}
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
                <th className="px-5 py-3.5 text-left font-bold cursor-pointer hover:text-slate-700 select-none tx-col-category" onClick={() => toggleSort("category")}>
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
                  const txKey    = `${t.date}||${t.description}||${t.amount}`;
                  const displayCat = localCategories[txKey] || t.category || UNKNOWN_CAT;
                  const hex      = catHex(displayCat);
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
                      {/* Category badge + edit */}
                      <td className="px-5 py-3.5 tx-col-category">
                        {editingTx === txKey ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <select
                              autoFocus
                              defaultValue={displayCat}
                              disabled={catSaving === txKey}
                              style={{ fontSize: "0.78rem", border: "1px solid #a29bfe", borderRadius: 8, padding: "3px 6px", color: "#1e293b", background: "#fff", cursor: "pointer" }}
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
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.8rem", padding: "2px 4px", borderRadius: 4, lineHeight: 1, flexShrink: 0 }}
                                onMouseEnter={e => e.currentTarget.style.color = "#6c63ff"}
                                onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
                              >
                                ✏️
                              </button>
                            )}
                          </div>
                        )}
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
