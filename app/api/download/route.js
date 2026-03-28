import ExcelJS from "exceljs";

const DARK_BLUE  = "FF1e3a5f";
const GBP        = '£#,##0.00';
const GBP_SIGNED = '"+£"#,##0.00;"-£"#,##0.00';

function thin()  { return { style: "thin",   color: { argb: "FFD1D5DB" } }; }
function thick(argb) { return { style: "thick",  color: { argb } }; }
function medium(argb) { return { style: "medium", color: { argb } }; }
function thinBorder() {
  return { top: thin(), left: thin(), bottom: thin(), right: thin() };
}

function applyHeader(cell, text) {
  cell.value     = text;
  cell.font      = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BLUE } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border    = thinBorder();
}

function applyData(cell, bg) {
  cell.font      = { name: "Calibri", size: 11, color: { argb: "FF111827" } };
  cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bg || "FFFFFFFF" } };
  cell.alignment = { vertical: "middle" };
  cell.border    = thinBorder();
}

function textBar(value, maxValue, width) {
  if (!maxValue || maxValue <= 0 || value <= 0) return "";
  return "█".repeat(Math.min(Math.round((value / maxValue) * width), width));
}

export async function POST(request) {
  const body         = await request.json().catch(() => ({}));
  const transactions = Array.isArray(body.transactions) ? body.transactions : [];

  // ── Pre-compute all aggregated data ─────────────────────────────────────────
  let totalIncome = 0, totalExpenses = 0;
  const categoryTotals = {};
  const merchantTotals = {};
  const monthlyMap     = {};
  const MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;

    if (amt >= 0) {
      totalIncome += amt;
    } else {
      totalExpenses += Math.abs(amt);

      const cat = t.category || "Unknown";
      if (!categoryTotals[cat]) categoryTotals[cat] = { total: 0, count: 0 };
      categoryTotals[cat].total += Math.abs(amt);
      categoryTotals[cat].count++;

      const mer = t.description || "Unknown";
      if (!merchantTotals[mer]) merchantTotals[mer] = { total: 0, count: 0 };
      merchantTotals[mer].total += Math.abs(amt);
      merchantTotals[mer].count++;
    }

    // Monthly grouping
    const ds = String(t.date || "");
    let monthKey = "Unknown", monthSort = "00000";
    const m1 = ds.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m1) {
      const mi = MON.findIndex(m => m1[2].startsWith(m));
      if (mi >= 0) {
        monthKey  = `${m1[2].slice(0,3).replace(/^\w/, c => c.toUpperCase())} ${m1[3]}`;
        monthSort = `${m1[3]}${String(mi + 1).padStart(2,"0")}`;
      }
    } else {
      const m2 = ds.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m2) {
        monthKey  = `${m2[2].padStart(2,"0")}/${m2[3]}`;
        monthSort = `${m2[3]}${m2[2].padStart(2,"0")}`;
      }
    }
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { income: 0, expenses: 0, count: 0, sortKey: monthSort };
    if (amt >= 0) monthlyMap[monthKey].income   += amt;
    else          monthlyMap[monthKey].expenses  += Math.abs(amt);
    monthlyMap[monthKey].count++;
  });

  const netBalance  = totalIncome - totalExpenses;
  const netPos      = netBalance >= 0;

  const catEntries = Object.entries(categoryTotals)
    .map(([name, d]) => ({ name, total: d.total, count: d.count }))
    .sort((a, b) => b.total - a.total);

  const merEntries = Object.entries(merchantTotals)
    .map(([name, d]) => ({ name, total: d.total, count: d.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const monthlyRows = Object.entries(monthlyMap)
    .map(([label, d]) => ({ label, ...d }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const catMax    = catEntries.length > 0 ? catEntries[0].total : 1;
  const merMax    = merEntries.length > 0 ? merEntries[0].total : 1;
  const monIncMax = monthlyRows.reduce((m, r) => Math.max(m, r.income),   1);
  const monExpMax = monthlyRows.reduce((m, r) => Math.max(m, r.expenses), 1);

  const wb = new ExcelJS.Workbook();
  wb.creator = "StatementSense";

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: Dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  const dash = wb.addWorksheet("Dashboard");
  dash.properties.tabColor = { argb: "FF15803d" };
  dash.views  = [{ zoomScale: 120 }];
  dash.columns = [
    { width: 26 }, // A — category name / merchant name
    { width: 18 }, // B — total
    { width: 14 }, // C — count
    { width: 14 }, // D — %
    { width: 28 }, // E — visual bar
  ];

  // ── Row 1: Title ─────────────────────────────────────────────────────────
  dash.mergeCells("A1:E1");
  const titleCell     = dash.getCell("A1");
  titleCell.value     = "StatementSense — Statement Analysis";
  titleCell.font      = { name: "Calibri", bold: true, size: 20, color: { argb: DARK_BLUE } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  dash.getRow(1).height = 40;

  // ── Row 2: Spacer ─────────────────────────────────────────────────────────
  dash.getRow(2).height = 10;

  // ── Rows 3-6: Stat cards ──────────────────────────────────────────────────
  // Layout: rows 3-4 merged vertically = header; rows 5-6 merged = value
  // Each card sits in its own column (A=income, B=expenses, C=net, D=transactions)
  const cards = [
    {
      col: "A", label: "TOTAL INCOME",
      value: totalIncome, numFmt: GBP,
      accent: "FF15803d",
      hdrBg:  "FF166534", valBg: "FFf0fdf4",
      valColor: "FF15803d",
    },
    {
      col: "B", label: "TOTAL EXPENSES",
      value: totalExpenses, numFmt: GBP,
      accent: "FFdc2626",
      hdrBg:  "FFb91c1c", valBg: "FFfef2f2",
      valColor: "FFdc2626",
    },
    {
      col: "C", label: "NET BALANCE",
      value: netBalance, numFmt: GBP,
      accent:   netPos ? "FF1d4ed8" : "FFdc2626",
      hdrBg:    netPos ? "FF1e40af" : "FFb91c1c",
      valBg:    netPos ? "FFdbeafe" : "FFfef2f2",
      valColor: netPos ? "FF1d4ed8" : "FFdc2626",
    },
    {
      col: "D", label: "TRANSACTIONS",
      value: transactions.length, numFmt: null,
      accent: "FF7c3aed",
      hdrBg:  "FF6d28d9", valBg: "FFF5F3FF",
      valColor: "FF7c3aed",
    },
  ];

  // Merge header rows (3-4) and value rows (5-6) for each card column
  ["A","B","C","D"].forEach(col => {
    dash.mergeCells(`${col}3:${col}4`);
    dash.mergeCells(`${col}5:${col}6`);
  });
  dash.getRow(3).height = 26;
  dash.getRow(4).height = 26;
  dash.getRow(5).height = 35;
  dash.getRow(6).height = 35;

  cards.forEach((card, idx) => {
    const isFirst = idx === 0;
    const isLast  = idx === cards.length - 1;

    // Header cell (top-left of merged A3:A4)
    const hdr     = dash.getCell(`${card.col}3`);
    hdr.value     = card.label;
    hdr.font      = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    hdr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: card.hdrBg } };
    hdr.alignment = { horizontal: "center", vertical: "middle" };
    hdr.border    = {
      top:    medium(DARK_BLUE),
      left:   thick(card.accent),
      bottom: thin(),
      right:  isLast ? medium(DARK_BLUE) : thin(),
    };

    // Value cell (top-left of merged A5:A6)
    const val     = dash.getCell(`${card.col}5`);
    val.value     = card.value;
    if (card.numFmt) val.numFmt = card.numFmt;
    val.font      = { name: "Calibri", bold: true, size: 18, color: { argb: card.valColor } };
    val.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: card.valBg } };
    val.alignment = { horizontal: "center", vertical: "middle" };
    val.border    = {
      top:    thin(),
      left:   thick(card.accent),
      bottom: medium(DARK_BLUE),
      right:  isLast ? medium(DARK_BLUE) : thin(),
    };
  });

  // ── Row 7: Spacer ─────────────────────────────────────────────────────────
  dash.getRow(7).height = 14;

  // ── Row 8: Category banner ────────────────────────────────────────────────
  dash.mergeCells("A8:E8");
  const catBanner     = dash.getCell("A8");
  catBanner.value     = "SPENDING BY CATEGORY";
  catBanner.font      = { name: "Calibri", bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  catBanner.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BLUE } };
  catBanner.alignment = { horizontal: "center", vertical: "middle" };
  dash.getRow(8).height = 26;

  // ── Row 9: Category column headers ────────────────────────────────────────
  applyHeader(dash.getCell("A9"), "Category");
  applyHeader(dash.getCell("B9"), "Total Spent");
  applyHeader(dash.getCell("C9"), "Transactions");
  applyHeader(dash.getCell("D9"), "% of Spending");
  applyHeader(dash.getCell("E9"), "Visual");
  dash.getRow(9).height = 22;

  // ── Rows 10+: Category data ───────────────────────────────────────────────
  const catStart = 10;
  catEntries.forEach((cat, i) => {
    const r   = catStart + i;
    const pct = totalExpenses > 0 ? (cat.total / totalExpenses) : 0;
    const bar = textBar(cat.total, catMax, 20);
    const bg  = i % 2 === 0 ? "FFFFFFFF" : "FFf8fafc";

    applyData(dash.getCell(`A${r}`), bg);
    dash.getCell(`A${r}`).value = cat.name;

    applyData(dash.getCell(`B${r}`), bg);
    dash.getCell(`B${r}`).value  = cat.total;
    dash.getCell(`B${r}`).numFmt = GBP;
    dash.getCell(`B${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(dash.getCell(`C${r}`), bg);
    dash.getCell(`C${r}`).value     = cat.count;
    dash.getCell(`C${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(dash.getCell(`D${r}`), bg);
    dash.getCell(`D${r}`).value     = pct;
    dash.getCell(`D${r}`).numFmt    = "0.0%";
    dash.getCell(`D${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(dash.getCell(`E${r}`), bg);
    dash.getCell(`E${r}`).value = bar;
    dash.getCell(`E${r}`).font  = { name: "Calibri", size: 9, color: { argb: "FFdc2626" } };

    dash.getRow(r).height = 20;
  });

  // ── Spacer + Merchants section ────────────────────────────────────────────
  const merSpacer  = catStart + catEntries.length;
  const merBanner  = merSpacer + 1;
  const merHdr     = merBanner + 1;
  const merStart   = merHdr + 1;

  dash.getRow(merSpacer).height = 14;

  dash.mergeCells(`A${merBanner}:E${merBanner}`);
  const mb     = dash.getCell(`A${merBanner}`);
  mb.value     = "TOP 8 MERCHANTS";
  mb.font      = { name: "Calibri", bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  mb.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BLUE } };
  mb.alignment = { horizontal: "center", vertical: "middle" };
  dash.getRow(merBanner).height = 26;

  applyHeader(dash.getCell(`A${merHdr}`), "Merchant");
  applyHeader(dash.getCell(`B${merHdr}`), "Total Spent");
  applyHeader(dash.getCell(`C${merHdr}`), "Visits");
  applyHeader(dash.getCell(`D${merHdr}`), "");
  applyHeader(dash.getCell(`E${merHdr}`), "Visual");
  dash.getRow(merHdr).height = 22;

  merEntries.forEach((mer, i) => {
    const r   = merStart + i;
    const bar = textBar(mer.total, merMax, 20);
    const bg  = i % 2 === 0 ? "FFFFFFFF" : "FFf8fafc";

    applyData(dash.getCell(`A${r}`), bg);
    dash.getCell(`A${r}`).value = mer.name;

    applyData(dash.getCell(`B${r}`), bg);
    dash.getCell(`B${r}`).value  = mer.total;
    dash.getCell(`B${r}`).numFmt = GBP;
    dash.getCell(`B${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(dash.getCell(`C${r}`), bg);
    dash.getCell(`C${r}`).value     = mer.count;
    dash.getCell(`C${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(dash.getCell(`D${r}`), bg);

    applyData(dash.getCell(`E${r}`), bg);
    dash.getCell(`E${r}`).value = bar;
    dash.getCell(`E${r}`).font  = { name: "Calibri", size: 9, color: { argb: "FF1d4ed8" } };

    dash.getRow(r).height = 20;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: Transactions
  // ═══════════════════════════════════════════════════════════════════════════
  const txSheet = wb.addWorksheet("Transactions");
  txSheet.properties.tabColor = { argb: "FF1d4ed8" };
  txSheet.columns = [
    { width: 14 }, // A Date
    { width: 46 }, // B Description
    { width: 22 }, // C Category
    { width: 12 }, // D Type
    { width: 17 }, // E Amount
    { width: 17 }, // F Running Balance
  ];

  // Row 1: Title
  txSheet.mergeCells("A1:F1");
  const txTitle     = txSheet.getCell("A1");
  txTitle.value     = "StatementSense — All Transactions";
  txTitle.font      = { name: "Calibri", bold: true, size: 20, color: { argb: DARK_BLUE } };
  txTitle.alignment = { horizontal: "center", vertical: "middle" };
  txSheet.getRow(1).height = 40;
  txSheet.getRow(2).height = 8;

  // Row 3: Headers
  ["Date","Description","Category","Type","Amount","Running Balance"].forEach((h, idx) => {
    applyHeader(txSheet.getCell(`${"ABCDEF"[idx]}3`), h);
  });
  txSheet.getRow(3).height = 24;

  txSheet.views      = [{ state: "frozen", ySplit: 3, zoomScale: 120 }];
  txSheet.autoFilter = "A3:F3";

  // Sort by date string then write rows
  const sorted = [...transactions].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || ""))
  );

  let runningBal = 0;
  sorted.forEach((t, i) => {
    const r        = 4 + i;
    const amt      = Number(t.amount) || 0;
    runningBal    += amt;
    const snapBal  = runningBal;
    const isIncome = amt >= 0;

    // Alternating subtle tint within income/expense groups
    const bg       = isIncome
      ? (i % 2 === 0 ? "FFf0fdf4" : "FFdcfce7")
      : (i % 2 === 0 ? "FFfef2f2" : "FFfee2e2");
    const amtColor = isIncome ? "FF15803d" : "FFdc2626";
    const balColor = snapBal >= 0 ? "FF15803d" : "FFdc2626";
    const balBg    = snapBal >= 0 ? "FFf0fdf4" : "FFfef2f2";

    applyData(txSheet.getCell(`A${r}`), bg);
    txSheet.getCell(`A${r}`).value = t.date || "";

    applyData(txSheet.getCell(`B${r}`), bg);
    txSheet.getCell(`B${r}`).value = t.description || "";

    applyData(txSheet.getCell(`C${r}`), bg);
    txSheet.getCell(`C${r}`).value = t.category || "";

    applyData(txSheet.getCell(`D${r}`), bg);
    txSheet.getCell(`D${r}`).value     = t.type || "";
    txSheet.getCell(`D${r}`).alignment = { horizontal: "center", vertical: "middle" };

    // Amount: signed format (+£ / -£), colored
    const amtCell     = txSheet.getCell(`E${r}`);
    applyData(amtCell, bg);
    amtCell.value     = amt;
    amtCell.numFmt    = GBP_SIGNED;
    amtCell.font      = { name: "Calibri", bold: true, size: 11, color: { argb: amtColor } };
    amtCell.alignment = { horizontal: "right", vertical: "middle" };

    // Running balance: separate green/red background
    const balCell     = txSheet.getCell(`F${r}`);
    applyData(balCell, balBg);
    balCell.value     = snapBal;
    balCell.numFmt    = GBP;
    balCell.font      = { name: "Calibri", bold: true, size: 11, color: { argb: balColor } };
    balCell.alignment = { horizontal: "right", vertical: "middle" };

    txSheet.getRow(r).height = 19;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3: Monthly Summary
  // ═══════════════════════════════════════════════════════════════════════════
  const monSheet = wb.addWorksheet("Monthly Summary");
  monSheet.properties.tabColor = { argb: "FF7c3aed" };
  monSheet.columns = [
    { width: 18 }, // A Month
    { width: 16 }, // B Income
    { width: 16 }, // C Expenses
    { width: 16 }, // D Net
    { width: 13 }, // E Transactions
    { width: 22 }, // F Income Bar
    { width: 22 }, // G Expenses Bar
  ];

  // Row 1: Title
  monSheet.mergeCells("A1:G1");
  const monTitle     = monSheet.getCell("A1");
  monTitle.value     = "StatementSense — Monthly Summary";
  monTitle.font      = { name: "Calibri", bold: true, size: 20, color: { argb: DARK_BLUE } };
  monTitle.alignment = { horizontal: "center", vertical: "middle" };
  monSheet.getRow(1).height = 40;
  monSheet.getRow(2).height = 8;

  // Row 3: Headers
  ["Month","Income","Expenses","Net","Transactions","Income Bar","Expenses Bar"].forEach((h, idx) => {
    applyHeader(monSheet.getCell(`${"ABCDEFG"[idx]}3`), h);
  });
  monSheet.getRow(3).height = 24;

  monSheet.views = [{ state: "frozen", ySplit: 3, zoomScale: 120 }];

  monthlyRows.forEach((mon, i) => {
    const r        = 4 + i;
    const net      = mon.income - mon.expenses;
    const bg       = i % 2 === 0 ? "FFFFFFFF" : "FFf8fafc";
    const netColor = net >= 0 ? "FF15803d" : "FFdc2626";
    const netBg    = net >= 0 ? "FFf0fdf4" : "FFfef2f2";
    const incBar   = textBar(mon.income,   monIncMax, 18);
    const expBar   = textBar(mon.expenses, monExpMax, 18);

    applyData(monSheet.getCell(`A${r}`), bg);
    monSheet.getCell(`A${r}`).value = mon.label;

    applyData(monSheet.getCell(`B${r}`), bg);
    monSheet.getCell(`B${r}`).value     = mon.income;
    monSheet.getCell(`B${r}`).numFmt    = GBP;
    monSheet.getCell(`B${r}`).font      = { name: "Calibri", size: 11, color: { argb: "FF15803d" } };
    monSheet.getCell(`B${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(monSheet.getCell(`C${r}`), bg);
    monSheet.getCell(`C${r}`).value     = mon.expenses;
    monSheet.getCell(`C${r}`).numFmt    = GBP;
    monSheet.getCell(`C${r}`).font      = { name: "Calibri", size: 11, color: { argb: "FFdc2626" } };
    monSheet.getCell(`C${r}`).alignment = { horizontal: "right", vertical: "middle" };

    // Net: colored background + bold font
    applyData(monSheet.getCell(`D${r}`), netBg);
    monSheet.getCell(`D${r}`).value     = net;
    monSheet.getCell(`D${r}`).numFmt    = GBP;
    monSheet.getCell(`D${r}`).font      = { name: "Calibri", bold: true, size: 11, color: { argb: netColor } };
    monSheet.getCell(`D${r}`).alignment = { horizontal: "right", vertical: "middle" };

    applyData(monSheet.getCell(`E${r}`), bg);
    monSheet.getCell(`E${r}`).value     = mon.count;
    monSheet.getCell(`E${r}`).alignment = { horizontal: "right", vertical: "middle" };

    // Income bar (green)
    applyData(monSheet.getCell(`F${r}`), bg);
    monSheet.getCell(`F${r}`).value = incBar;
    monSheet.getCell(`F${r}`).font  = { name: "Calibri", size: 9, color: { argb: "FF15803d" } };

    // Expenses bar (red)
    applyData(monSheet.getCell(`G${r}`), bg);
    monSheet.getCell(`G${r}`).value = expBar;
    monSheet.getCell(`G${r}`).font  = { name: "Calibri", size: 9, color: { argb: "FFdc2626" } };

    monSheet.getRow(r).height = 22;
  });

  // Totals row
  const totRow      = 4 + monthlyRows.length;
  const totIncome   = monthlyRows.reduce((s, r) => s + r.income,   0);
  const totExpenses = monthlyRows.reduce((s, r) => s + r.expenses, 0);
  const totNet      = totIncome - totExpenses;
  const totCount    = monthlyRows.reduce((s, r) => s + r.count,    0);

  "ABCDEFG".split("").forEach(col => {
    const cell     = monSheet.getCell(`${col}${totRow}`);
    cell.font      = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: DARK_BLUE } };
    cell.alignment = { horizontal: col === "A" ? "left" : "right", vertical: "middle" };
    cell.border    = thinBorder();
  });
  monSheet.getCell(`A${totRow}`).value = "TOTAL";
  monSheet.getCell(`B${totRow}`).value = totIncome;   monSheet.getCell(`B${totRow}`).numFmt = GBP;
  monSheet.getCell(`C${totRow}`).value = totExpenses; monSheet.getCell(`C${totRow}`).numFmt = GBP;
  monSheet.getCell(`D${totRow}`).value = totNet;      monSheet.getCell(`D${totRow}`).numFmt = GBP;
  monSheet.getCell(`E${totRow}`).value = totCount;
  monSheet.getRow(totRow).height = 26;

  // ── Write buffer and respond ─────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="statement-analysis.xlsx"',
      "Content-Length":      String(buffer.byteLength),
    },
  });
}
