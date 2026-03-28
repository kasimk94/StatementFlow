"use client";

import { useMemo, useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmt(amount) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}
function fmtShort(amount) {
  if (Math.abs(amount) >= 1000) {
    return "£" + (amount / 1000).toFixed(1) + "k";
  }
  return fmt(amount);
}

// ─── Category config ─────────────────────────────────────────────────────────
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

function catHex(name) {
  return (CAT_CONFIG[name] ?? CAT_CONFIG[UNKNOWN_CAT]).hex;
}
function catBadge(name) {
  return (CAT_CONFIG[name] ?? CAT_CONFIG[UNKNOWN_CAT]).badge;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ name }) {
  const cls = catBadge(name);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 whitespace-nowrap ${cls}`}>
      {name}
    </span>
  );
}

// Stat card (Section 1)
function StatCard({ label, value, sub, accent, icon }) {
  const accentMap = {
    green:  { bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-700",  icon: "bg-emerald-100 text-emerald-600" },
    red:    { bg: "bg-red-50",      border: "border-red-200",     text: "text-red-700",      icon: "bg-red-100 text-red-600" },
    blue:   { bg: "bg-blue-50",     border: "border-blue-200",    text: "text-blue-700",     icon: "bg-blue-100 text-blue-600" },
    purple: { bg: "bg-purple-50",   border: "border-purple-200",  text: "text-purple-700",   icon: "bg-purple-100 text-purple-600" },
  };
  const a = accentMap[accent] ?? accentMap.blue;
  return (
    <div className={`rounded-2xl border ${a.border} ${a.bg} p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 truncate ${a.text}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Custom recharts tooltip
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

// Custom legend for pie chart
function PieLegend({ data }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3 px-2">
      {data.map((entry) => (
        <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: entry.fill }} />
          <span className="max-w-[100px] truncate">{entry.name}</span>
          <span className="font-semibold text-slate-700">{fmtShort(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Horizontal bar chart tooltip
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
export default function Dashboard({ transactions }) {
  const [search, setSearch]       = useState("");
  const [sortKey, setSortKey]     = useState("date");
  const [sortDir, setSortDir]     = useState("desc");
  const [page, setPage]           = useState(1);
  const [filterCat, setFilterCat] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [downloading, setDownloading]     = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  // ── Download handler ──
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/download", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transactions }),
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

  // ── Category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.amount >= 0) continue; // expenses only
      const cat = t.category || UNKNOWN_CAT;
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += Math.abs(t.amount);
      map[cat].count += 1;
    }
    const entries = Object.entries(map)
      .map(([name, { total, count }]) => ({ name, total, count }));
    const unknown = entries.filter((e) => e.name === UNKNOWN_CAT);
    const rest    = entries.filter((e) => e.name !== UNKNOWN_CAT).sort((a, b) => b.total - a.total);
    return [...rest, ...unknown];
  }, [transactions]);

  // ── Pie chart data ──
  const pieData = useMemo(() =>
    categoryBreakdown.map((c) => ({
      name: c.name,
      value: c.total,
      fill: catHex(c.name),
    })),
  [categoryBreakdown]);

  // ── Top-8 merchants bar data ──
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

  // ── Filtered + sorted ──
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
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    setFilterCat(cat);
    setPage(1);
  }

  return (
    <div className="space-y-6">

      {/* ── SECTION 1: Stat cards + Download ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-slate-800">Overview</h2>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl px-5 py-2.5 transition-colors shadow-sm"
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
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Excel
              </>
            )}
          </button>
        </div>

        {downloadError && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {downloadError}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Income"
            value={fmt(income)}
            sub={`${incomeCount} credit${incomeCount !== 1 ? "s" : ""}`}
            accent="green"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            }
          />
          <StatCard
            label="Total Expenses"
            value={fmt(expenses)}
            sub={`${expenseCount} debit${expenseCount !== 1 ? "s" : ""}`}
            accent="red"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            }
          />
          <StatCard
            label="Net Balance"
            value={fmt(net)}
            sub={net >= 0 ? "Positive cash flow" : "Negative cash flow"}
            accent={net >= 0 ? "blue" : "red"}
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Transactions"
            value={transactions.length.toLocaleString()}
            sub={`${incomeCount} in · ${expenseCount} out`}
            accent="purple"
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
        </div>
      </div>

      {/* ── SECTION 2: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-1">Spending Breakdown</h3>
          <p className="text-xs text-slate-400 mb-4">Expenses by category</p>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No expense data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ReTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <PieLegend data={pieData} />
            </>
          )}
        </div>

        {/* Horizontal bar chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-1">Top Merchants</h3>
          <p className="text-xs text-slate-400 mb-4">Top 8 by total spend</p>
          {barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={fmtShort}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                />
                <ReTooltip content={<BarTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="expense" name="Expense" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={18} />
                <Bar dataKey="income"  name="Income"  fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── SECTION 3: Category cards ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-800">Spending by Category</h3>
          {filterCat !== "All" && (
            <button
              onClick={() => setFilter("All")}
              className="text-xs text-blue-600 hover:underline"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {categoryBreakdown.map(({ name, total, count }) => {
            const hex       = catHex(name);
            const pct       = expenses > 0 ? (total / expenses) * 100 : 0;
            const isActive  = filterCat === name;
            const isUnknown = name === UNKNOWN_CAT;
            return (
              <button
                key={name}
                onClick={() => setFilter(isActive ? "All" : name)}
                className={`group relative text-left rounded-xl border transition-all overflow-hidden hover:shadow-md ${
                  isActive
                    ? "border-blue-400 ring-2 ring-blue-200 bg-blue-50"
                    : isUnknown
                    ? "border-red-200 bg-red-50/40 hover:border-red-300"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {/* coloured left border accent */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: hex }} />
                <div className="pl-4 pr-3 py-3">
                  <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{name}</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{fmt(total)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{count} txn{count !== 1 ? "s" : ""}</p>
                  {/* progress bar */}
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: hex }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{pct.toFixed(1)}% of spend</p>
                </div>
                {isUnknown && (
                  <span className="hidden group-hover:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 z-10 shadow-lg pointer-events-none text-center">
                    These transactions couldn&apos;t be automatically categorised — review manually.
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 4: Transactions table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <h3 className="text-base font-semibold text-slate-800 shrink-0">
            Transactions
            {filterCat !== "All" && (
              <span className="ml-2 text-xs font-normal text-slate-400">filtered by {filterCat}</span>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-40 sm:w-48 bg-slate-50"
              />
            </div>
            {/* Category filter */}
            <select
              value={filterCat}
              onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-700"
            >
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {/* Type filter */}
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-700"
            >
              <option value="All">All types</option>
              <option value="Income">Income only</option>
              <option value="Expense">Expenses only</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-slate-700 select-none whitespace-nowrap" onClick={() => toggleSort("date")}>
                  Date <SortIcon col="date" />
                </th>
                <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("description")}>
                  Description <SortIcon col="description" />
                </th>
                <th className="px-4 py-3 text-left font-semibold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("category")}>
                  Category <SortIcon col="category" />
                </th>
                <th className="px-4 py-3 text-right font-semibold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("amount")}>
                  Amount <SortIcon col="amount" />
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                paginated.map((t, i) => {
                  const isIncome  = t.amount >= 0;
                  const rowBg     = i % 2 === 0 ? "bg-white" : "bg-slate-50/60";
                  const amtColor  = isIncome ? "text-emerald-600" : "text-red-600";
                  return (
                    <tr key={i} className={`${rowBg} hover:bg-blue-50/40 transition-colors border-b border-slate-100`}>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap font-mono text-xs">{t.date}</td>
                      <td className="px-4 py-3.5 text-slate-700 max-w-[200px]">
                        <span className="truncate block">{t.description}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <CategoryBadge name={t.category || UNKNOWN_CAT} />
                      </td>
                      <td className={`px-4 py-3.5 text-right font-semibold whitespace-nowrap ${amtColor}`}>
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
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50/60">
            <span className="text-xs">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium"
              >
                ← Prev
              </button>
              {/* Page numbers — show up to 5 */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                let p;
                if (totalPages <= 5) p = idx + 1;
                else if (page <= 3) p = idx + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + idx;
                else p = page - 2 + idx;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium border transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 hover:bg-white text-slate-600"
                    }`}
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
    </div>
  );
}
