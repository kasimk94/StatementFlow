import ExcelJS from "exceljs";

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONT      = "Aptos";
const GBP       = '"£"#,##0.00';
const PCT       = '0.0%';

const WHITE     = "FFFFFFFF";
const ROW_ALT   = "FFFAFAFA";
const HDR_BG    = "FFf0f4ff";   // all header rows: very light blue
const HDR_TXT   = "FF2d3436";   // dark grey header text
const BODY_TXT  = "FF444444";
const SEC_TXT   = "FF888888";
const BORDER    = "FFE0E0E0";
const TITLE_C   = "FF1a1a2e";   // brand title dark
const ACCENT    = "FF6c5ce7";   // purple accent line
const TOT_BG    = "FFf0f0f0";   // total rows

// KPI palette  { bg, val colour, brd }
const KPI = {
  income:  { bg: "FFf0faf5", val: "FF00b894", brd: "FF00b894" },
  expense: { bg: "FFfff5f5", val: "FFe17055", brd: "FFe17055" },
  netPos:  { bg: "FFf0f4ff", val: "FF6c5ce7", brd: "FF6c5ce7" },
  netNeg:  { bg: "FFfff5f5", val: "FFe17055", brd: "FFe17055" },
  txn:     { bg: "FFfaf0ff", val: "FFa29bfe", brd: "FFa29bfe" },
};

// Category accent strip colours (narrow col A)
const CAT_ACCENT_MAP = {
  "Income":              "FF00b894",
  "Refunds":             "FF00cec9",
  "Groceries":           "FF00b894",
  "Shopping":            "FF6c5ce7",
  "Fast Food":           "FFfdcb6e",
  "Eating Out":          "FFf39c12",
  "Transport":           "FF74b9ff",
  "Entertainment":       "FFa29bfe",
  "Health & Beauty":     "FFfd79a8",
  "Bills & Finance":     "FFe17055",
  "ATM & Cash":          "FFffeaa7",
  "Charity & Donations": "FFfd79a8",
  "Transfers":           "FFfdcb6e",
  "Vaping & Tobacco":    "FFa8e063",
};
function catAccent(name) { return CAT_ACCENT_MAP[name] || "FF74b9ff"; }

// Unicode block-character spend bar (20 chars wide)
function spendBar(pct, width = 18) {
  const filled = Math.max(0, Math.min(width, Math.round(pct * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ─── Border factories ─────────────────────────────────────────────────────────
const bThin   = (argb = BORDER) => ({ style: "thin",   color: { argb } });
const bMedium = (argb = ACCENT) => ({ style: "medium", color: { argb } });
const bNone   = ()               => ({ style: "none" });
const noB     = () => ({ top: bNone(), left: bNone(), bottom: bNone(), right: bNone() });
const botThin = () => ({ top: bNone(), left: bNone(), bottom: bThin(), right: bNone() });
const botAccent = () => ({ top: bNone(), left: bNone(), bottom: bMedium(ACCENT), right: bNone() });
const topThin = () => ({ top: bThin(), left: bNone(), bottom: bNone(), right: bNone() });

// ─── Fill helper ──────────────────────────────────────────────────────────────
const solidFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// ─── Generic cell setter ──────────────────────────────────────────────────────
function sc(cell, { v, font = {}, bg = WHITE, align = {}, border = noB(), fmt } = {}) {
  if (v !== undefined) cell.value = v;
  cell.font      = { name: FONT, size: 11, color: { argb: BODY_TXT }, ...font };
  cell.fill      = solidFill(bg);
  cell.alignment = { vertical: "middle", wrapText: false, ...align };
  cell.border    = border;
  if (fmt) cell.numFmt = fmt;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseDate(ds) {
  if (!ds) return null;
  const s = String(ds);
  let m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)))  return new Date(+m[3], +m[2]-1, +m[1]);
  if ((m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)))    return new Date(+m[3], +m[2]-1, +m[1]);
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/))) {
    const mi = MONTHS.findIndex(mo => m[2].toLowerCase().startsWith(mo.toLowerCase()));
    if (mi >= 0) return new Date(+m[3], mi, +m[1]);
  }
  return null;
}
function fmtDate(d) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function toDateStr(ds) { const d = parseDate(ds); return d ? fmtDate(d) : String(ds || ""); }

// ─── Reusable: write identical 4-row title header on any sheet ───────────────
// Row 1: "StatementFlow" title  Row 2: tab subtitle (italic)
// Row 3: generated line + thin purple bottom border  Row 4: blank spacer
function writeTitleHeader(sheet, colSpan, title, subtitle, generatedLine) {
  const cols = colSpan;

  // Row 1 — tab title
  sheet.mergeCells(`A1:${cols}1`);
  const r1 = sheet.getCell("A1");
  r1.value     = title;
  r1.font      = { name: "Calibri", bold: true, size: 20, color: { argb: TITLE_C } };
  r1.fill      = solidFill(WHITE);
  r1.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  r1.border    = noB();
  sheet.getRow(1).height = 38;

  // Row 2 — tab subtitle, italic
  sheet.mergeCells(`A2:${cols}2`);
  const r2 = sheet.getCell("A2");
  r2.value     = subtitle;
  r2.font      = { name: "Calibri", size: 11, italic: true, color: { argb: SEC_TXT } };
  r2.fill      = solidFill(WHITE);
  r2.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  r2.border    = noB();
  sheet.getRow(2).height = 22;

  // Row 3 — generated line with thin purple bottom border
  sheet.mergeCells(`A3:${cols}3`);
  const r3 = sheet.getCell("A3");
  r3.value     = generatedLine;
  r3.font      = { name: "Calibri", size: 10, color: { argb: "FFaaaaaa" } };
  r3.fill      = solidFill(WHITE);
  r3.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  r3.border    = { bottom: bThin(ACCENT) };
  sheet.getRow(3).height = 18;

  // Row 4 — blank spacer
  sheet.mergeCells(`A4:${cols}4`);
  sheet.getCell("A4").fill   = solidFill(WHITE);
  sheet.getCell("A4").border = noB();
  sheet.getRow(4).height = 12;
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request) {
  const body         = await request.json().catch(() => ({}));
  const transactions = Array.isArray(body.transactions) ? body.transactions : [];

  // ── Aggregation ─────────────────────────────────────────────────────────────
  let totalIncome = 0, totalExpenses = 0;
  const categoryTotals = {};
  const merchantTotals = {};

  for (const t of transactions) {
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
  }

  const netBalance = totalIncome - totalExpenses;
  const catEntries = Object.entries(categoryTotals)
    .map(([name, d]) => ({ name, total: d.total, count: d.count, avg: d.count > 0 ? d.total/d.count : 0 }))
    .sort((a, b) => b.total - a.total);
  const merEntries = Object.entries(merchantTotals)
    .map(([name, d]) => ({ name, total: d.total, count: d.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const parsedDates  = transactions.map(t => parseDate(t.date)).filter(Boolean);
  const minDate      = parsedDates.length ? new Date(Math.min(...parsedDates.map(d => d.getTime()))) : null;
  const maxDate      = parsedDates.length ? new Date(Math.max(...parsedDates.map(d => d.getTime()))) : null;
  const now          = new Date();
  const todayStr     = fmtDate(now);
  const fileDate     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const dateRangeStr = minDate && maxDate ? `${fmtDate(minDate)} – ${fmtDate(maxDate)}` : "—";
  const generatedSub = `StatementFlow · Generated ${todayStr}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "StatementFlow";
  wb.views   = [{ activeTab: 0 }];

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1 — Dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  const dash = wb.addWorksheet("Dashboard");
  dash.properties.tabColor = { argb: "FF5b4cce" };
  dash.views = [{ zoomScale: 100, activeCell: "A1" }];

  // Columns: A(3 accent) B(22) C(14) D(12) E(3 gap) F(26) G(16) H(12) I(3 bar)
  dash.columns = [
    { width: 3  }, // A accent strip
    { width: 22 }, // B
    { width: 14 }, // C
    { width: 12 }, // D
    { width: 3  }, // E gap
    { width: 26 }, // F
    { width: 16 }, // G
    { width: 12 }, // H
  ];

  // ── Rows 1–4: Shared title header ───────────────────────────────────────
  writeTitleHeader(dash, "H", "StatementFlow", "Bank Statement Analysis Report", `Generated: ${todayStr}   ·   ${transactions.length} transactions`);

  // ── KPI Boxes (rows 5–11) ────────────────────────────────────────────────
  // Structure per box: top-pad / label / value / subtitle / bottom-pad
  // 5=top-pad 6=label 7=value(tall) 8=subtitle 9=bottom-pad — using rows 5-9
  const kpiDefs = [
    { c1: "A", c2: "B", label: "TOTAL INCOME",   value: "£" + totalIncome.toLocaleString("en-GB",{minimumFractionDigits:2}),   sub: `${transactions.filter(t=>t.amount>0).length} credits`,  ...KPI.income  },
    { c1: "C", c2: "D", label: "TOTAL EXPENSES",  value: "£" + totalExpenses.toLocaleString("en-GB",{minimumFractionDigits:2}), sub: `${transactions.filter(t=>t.amount<0).length} debits`,   ...KPI.expense },
    { c1: "E", c2: "F", label: "NET BALANCE",      value: (netBalance>=0?"£":"–£") + Math.abs(netBalance).toLocaleString("en-GB",{minimumFractionDigits:2}), sub: netBalance>=0 ? "Positive cash flow" : "Negative cash flow", ...(netBalance>=0?KPI.netPos:KPI.netNeg) },
    { c1: "G", c2: "H", label: "TRANSACTIONS",     value: String(transactions.length),                                                                        sub: dateRangeStr,                ...KPI.txn     },
  ];

  // Row heights: 5=16(top pad) 6=25(label) 7=45(value) 8=20(sub) 9=16(bot pad)
  [5,9].forEach(r  => { dash.getRow(r).height = 16; });
  dash.getRow(6).height = 25;
  dash.getRow(7).height = 45;
  dash.getRow(8).height = 20;

  kpiDefs.forEach(({ c1, c2, label, value, sub, bg, val: valClr, brd }) => {
    const leftBorder  = r => ({ top: bNone(), left: bThin(brd), bottom: bNone(), right: bNone() });
    const rightBorder = r => ({ top: bNone(), left: bNone(),    bottom: bNone(), right: bThin(brd) });
    const fullSide    = () => ({ top: bNone(), left: bThin(brd), bottom: bNone(), right: bThin(brd) });
    const topBrd      = () => ({ top: bThin(brd), left: bThin(brd), bottom: bNone(), right: bThin(brd) });
    const botBrd      = () => ({ top: bNone(), left: bThin(brd), bottom: bThin(brd), right: bThin(brd) });

    // row 5: top border
    dash.mergeCells(`${c1}5:${c2}5`);
    sc(dash.getCell(`${c1}5`), { bg, border: topBrd() });

    // row 6: label
    dash.mergeCells(`${c1}6:${c2}6`);
    sc(dash.getCell(`${c1}6`), { v: label, bg, font: { size: 10, color: { argb: "FF999999" } }, align: { horizontal: "center", vertical: "bottom" }, border: fullSide() });

    // row 7: value
    dash.mergeCells(`${c1}7:${c2}7`);
    sc(dash.getCell(`${c1}7`), { v: value, bg, font: { bold: true, size: 26, color: { argb: valClr } }, align: { horizontal: "center", vertical: "middle" }, border: fullSide() });

    // row 8: subtitle
    dash.mergeCells(`${c1}8:${c2}8`);
    sc(dash.getCell(`${c1}8`), { v: sub, bg, font: { size: 9, color: { argb: "FFaaaaaa" } }, align: { horizontal: "center", vertical: "top" }, border: fullSide() });

    // row 9: bottom border with coloured accent
    dash.mergeCells(`${c1}9:${c2}9`);
    sc(dash.getCell(`${c1}9`), { bg, border: botBrd() });
    // override bottom of row 9 to use accent colour
    dash.getCell(`${c1}9`).border = { top: bNone(), left: bThin(brd), bottom: bMedium(brd), right: bThin(brd) };
  });

  // ── Row 10: Spacer ───────────────────────────────────────────────────────
  dash.getRow(10).height = 16;

  // ── Spending by Category — cols A:D, starts row 11 ───────────────────────
  // Section title
  dash.mergeCells("A11:D11");
  sc(dash.getCell("A11"), { v: "Spending by Category", font: { bold: true, size: 12, color: { argb: TITLE_C } }, align: { horizontal: "left", indent: 0 }, border: botThin() });
  dash.getRow(11).height = 28;

  // Header row 12
  [["A",""], ["B","Category"], ["C","Amount"], ["D","Txns"]].forEach(([col, label]) => {
    const cell = dash.getCell(`${col}12`);
    sc(cell, { v: label, bg: HDR_BG, font: { bold: true, size: 10, color: { argb: HDR_TXT } }, align: { horizontal: col==="A"?"center":col==="B"?"left":"right", indent: col==="B"?1:0 }, border: botThin() });
  });
  dash.getRow(12).height = 26;

  const CAT_DATA_START = 13;
  catEntries.forEach(({ name, total, count }, i) => {
    const row = CAT_DATA_START + i;
    const bg  = i % 2 === 0 ? WHITE : ROW_ALT;
    const brd = i === catEntries.length - 1 ? botThin() : noB();

    // A: colour accent strip
    dash.getCell(`A${row}`).fill   = solidFill(catAccent(name));
    dash.getCell(`A${row}`).border = noB();

    sc(dash.getCell(`B${row}`), { v: name,  bg, align: { horizontal: "left", indent: 1 }, border: brd });
    sc(dash.getCell(`C${row}`), { v: total, bg, fmt: GBP, align: { horizontal: "right" }, border: brd });
    sc(dash.getCell(`D${row}`), { v: count, bg, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "right" }, border: brd });
    dash.getRow(row).height = 22;
  });

  // Category total row
  const catTotR = CAT_DATA_START + catEntries.length;
  const totCount = catEntries.reduce((s, c) => s + c.count, 0);
  dash.getCell(`A${catTotR}`).fill = solidFill(TOT_BG); dash.getCell(`A${catTotR}`).border = noB();
  sc(dash.getCell(`B${catTotR}`), { v: "Total", bg: TOT_BG, font: { bold: true, size: 11, color: { argb: HDR_TXT } }, align: { horizontal: "left", indent: 1 }, border: topThin() });
  sc(dash.getCell(`C${catTotR}`), { v: totalExpenses, bg: TOT_BG, fmt: GBP, font: { bold: true, size: 11, color: { argb: HDR_TXT } }, align: { horizontal: "right" }, border: topThin() });
  sc(dash.getCell(`D${catTotR}`), { v: totCount, bg: TOT_BG, font: { bold: true, size: 11, color: { argb: HDR_TXT } }, align: { horizontal: "right" }, border: topThin() });
  dash.getRow(catTotR).height = 24;

  // ── Top Merchants — cols F:H, starts row 11 ──────────────────────────────
  dash.mergeCells("F11:H11");
  sc(dash.getCell("F11"), { v: "Top Merchants", font: { bold: true, size: 12, color: { argb: TITLE_C } }, align: { horizontal: "left" }, border: botThin() });

  [["F","Merchant"], ["G","Spent"], ["H","Visits"]].forEach(([col, label]) => {
    sc(dash.getCell(`${col}12`), { v: label, bg: HDR_BG, font: { bold: true, size: 10, color: { argb: HDR_TXT } }, align: { horizontal: col==="F"?"left":"right", indent: col==="F"?1:0 }, border: botThin() });
  });

  merEntries.forEach(({ name, total, count }, i) => {
    const row = CAT_DATA_START + i;
    const bg  = i % 2 === 0 ? WHITE : ROW_ALT;
    const brd = i === merEntries.length - 1 ? botThin() : noB();
    sc(dash.getCell(`F${row}`), { v: name,  bg, align: { horizontal: "left", indent: 1 }, border: brd });
    sc(dash.getCell(`G${row}`), { v: total, bg, fmt: GBP, align: { horizontal: "right" }, border: brd });
    sc(dash.getCell(`H${row}`), { v: count, bg, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "right" }, border: brd });
    if (!dash.getRow(row).height || dash.getRow(row).height < 22) dash.getRow(row).height = 22;
  });

  // Merchants total
  if (merEntries.length > 0) {
    const mTotR = CAT_DATA_START + merEntries.length;
    const mTotS = merEntries.reduce((s,m)=>s+m.total, 0);
    const mTotC = merEntries.reduce((s,m)=>s+m.count, 0);
    sc(dash.getCell(`F${mTotR}`), { v: "Top 8 Total", bg: TOT_BG, font: { bold: true, size: 11, color: { argb: HDR_TXT } }, align: { horizontal: "left", indent: 1 }, border: topThin() });
    sc(dash.getCell(`G${mTotR}`), { v: mTotS, bg: TOT_BG, fmt: GBP, font: { bold: true, size: 11, color: { argb: HDR_TXT } }, align: { horizontal: "right" }, border: topThin() });
    sc(dash.getCell(`H${mTotR}`), { v: mTotC, bg: TOT_BG, font: { bold: true, size: 11, color: { argb: HDR_TXT } }, align: { horizontal: "right" }, border: topThin() });
    dash.getRow(mTotR).height = 24;
  }

  dash.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2 — Transactions
  // ═══════════════════════════════════════════════════════════════════════════
  const txSheet = wb.addWorksheet("Transactions");
  txSheet.properties.tabColor = { argb: "FF009e7e" };
  txSheet.columns = [
    { width: 16 }, // A Date
    { width: 45 }, // B Description
    { width: 20 }, // C Category
    { width: 14 }, // D Amount
    { width: 12 }, // E Type
    { width: 16 }, // F Balance
  ];

  // Title header rows 1-4
  writeTitleHeader(txSheet, "F", "Transactions", "Transactions", `Generated: ${todayStr}   ·   ${transactions.length} transactions`);

  // Data header — row 5
  txSheet.views = [{ state: "frozen", ySplit: 5, zoomScale: 100, activeCell: "A6" }];

  ["Date","Description","Category","Amount","Type","Balance"].forEach((h, i) => {
    const col  = "ABCDEF"[i];
    const cell = txSheet.getCell(`${col}5`);
    sc(cell, {
      v: h, bg: HDR_BG,
      font:   { bold: true, size: 11, color: { argb: HDR_TXT } },
      align:  { horizontal: i >= 3 ? "right" : "left", indent: i < 2 ? 1 : 0 },
      border: botAccent(),
    });
  });
  txSheet.getRow(5).height = 28;
  txSheet.autoFilter = { from: "A5", to: "F5" };

  const sorted = [...transactions].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || ""))
  );

  let runBal = 0;
  sorted.forEach((t, i) => {
    const row      = 6 + i;
    const amt      = Number(t.amount) || 0;
    runBal        += amt;
    const isCredit = amt >= 0;
    const bg       = i % 2 === 0 ? WHITE : ROW_ALT;
    const amtClr   = isCredit ? "FF00b894" : "FFe17055";
    const typeBg   = isCredit ? "FFf0faf5" : "FFfff5f5";
    const balClr   = runBal >= 0 ? "FF00b894" : "FFe17055";
    const accentClr = isCredit ? "FF00b894" : "FFe17055";
    const rowBorder = { top: bNone(), left: bNone(), bottom: bThin(), right: bNone() };

    // A: Date — medium left border accent (credit=green, debit=coral)
    const aCell = txSheet.getCell(`A${row}`);
    sc(aCell, { v: toDateStr(t.date), bg, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "left", indent: 1 }, border: { ...rowBorder, left: bMedium(accentClr) } });

    // B: Description — subtle right separator
    sc(txSheet.getCell(`B${row}`), { v: t.description || "", bg, align: { horizontal: "left", indent: 1 }, border: { ...rowBorder, right: bThin() } });

    // C: Category
    sc(txSheet.getCell(`C${row}`), { v: t.category || "", bg, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "left", indent: 1 }, border: rowBorder });

    // D: Amount
    sc(txSheet.getCell(`D${row}`), { v: Math.abs(amt), bg, fmt: GBP, font: { size: 11, color: { argb: amtClr } }, align: { horizontal: "right" }, border: rowBorder });

    // E: Type — tinted background
    sc(txSheet.getCell(`E${row}`), { v: isCredit ? "Credit" : "Debit", bg: typeBg, font: { size: 10, color: { argb: amtClr } }, align: { horizontal: "center" }, border: rowBorder });

    // F: Balance
    sc(txSheet.getCell(`F${row}`), { v: runBal, bg, fmt: GBP, font: { size: 11, color: { argb: balClr } }, align: { horizontal: "right" }, border: rowBorder });

    txSheet.getRow(row).height = 22;
  });

  txSheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 };

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 3 — Categories
  // ═══════════════════════════════════════════════════════════════════════════
  const catSheet = wb.addWorksheet("Categories");
  catSheet.properties.tabColor = { argb: "FF7c6ff7" };
  catSheet.columns = [
    { width: 3  }, // A  accent strip
    { width: 28 }, // B  category name
    { width: 16 }, // C  total spent
    { width: 14 }, // D  transactions
    { width: 16 }, // E  avg transaction
    { width: 12 }, // F  % of total
    { width: 22 }, // G  spend bar
  ];

  // Title header rows 1-4
  writeTitleHeader(catSheet, "G", "Category Breakdown", "Category Breakdown", `Generated: ${todayStr}   ·   ${transactions.length} transactions`);

  // Data header — row 5
  catSheet.views = [{ state: "frozen", ySplit: 5, zoomScale: 100, activeCell: "B6" }];

  [["A",""], ["B","Category"], ["C","Total Spent"], ["D","Txns"], ["E","Avg Txn"], ["F","% Total"], ["G","Spend Bar"]].forEach(([col, label]) => {
    const isRight = ["C","D","E","F","G"].includes(col);
    sc(catSheet.getCell(`${col}5`), {
      v: label, bg: HDR_BG,
      font:  { bold: true, size: 11, color: { argb: HDR_TXT } },
      align: { horizontal: isRight ? "right" : "left", indent: col==="B"?1:0 },
      border: botAccent(),
    });
  });
  catSheet.getRow(5).height = 28;

  catEntries.forEach(({ name, total, count, avg }, i) => {
    const row   = 6 + i;
    const bg    = i % 2 === 0 ? WHITE : ROW_ALT;
    const pct   = totalExpenses > 0 ? total / totalExpenses : 0;
    const isLast = i === catEntries.length - 1;
    const brd   = isLast ? botThin() : noB();
    const accent = catAccent(name);

    // A: accent strip
    catSheet.getCell(`A${row}`).fill   = solidFill(accent);
    catSheet.getCell(`A${row}`).border = noB();

    // B: name
    sc(catSheet.getCell(`B${row}`), { v: name, bg, align: { horizontal: "left", indent: 1 }, border: brd });

    // C: total — dark grey (not red)
    sc(catSheet.getCell(`C${row}`), { v: total, bg, fmt: GBP, align: { horizontal: "right" }, border: brd });

    // D: count
    sc(catSheet.getCell(`D${row}`), { v: count, bg, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "right" }, border: brd });

    // E: avg
    sc(catSheet.getCell(`E${row}`), { v: avg, bg, fmt: GBP, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "right" }, border: brd });

    // F: percentage
    sc(catSheet.getCell(`F${row}`), { v: pct, bg, fmt: PCT, font: { size: 11, color: { argb: SEC_TXT } }, align: { horizontal: "right" }, border: brd });

    // G: spend bar (block characters)
    const barCell = catSheet.getCell(`G${row}`);
    barCell.value     = spendBar(pct);
    barCell.font      = { name: "Courier New", size: 9, color: { argb: accent } };
    barCell.fill      = solidFill(bg);
    barCell.alignment = { horizontal: "left", vertical: "middle" };
    barCell.border    = brd;

    catSheet.getRow(row).height = 24;
  });

  // Total row
  const cTotR    = 6 + catEntries.length;
  const cTotTxns = catEntries.reduce((s, c) => s + c.count, 0);
  const cTotAvg  = cTotTxns > 0 ? totalExpenses / cTotTxns : 0;

  catSheet.getCell(`A${cTotR}`).fill   = solidFill(TOT_BG);
  catSheet.getCell(`A${cTotR}`).border = noB();

  [
    ["B", "Total",         null, { horizontal: "left", indent: 1 }],
    ["C", totalExpenses,   GBP,  { horizontal: "right" }],
    ["D", cTotTxns,        null, { horizontal: "right" }],
    ["E", cTotAvg,         GBP,  { horizontal: "right" }],
    ["F", totalExpenses > 0 ? 1 : 0, PCT, { horizontal: "right" }],
    ["G", "",              null, { horizontal: "left" }],
  ].forEach(([col, val, fmt, align]) => {
    sc(catSheet.getCell(`${col}${cTotR}`), {
      v: val, bg: TOT_BG, fmt,
      font:   { bold: true, size: 11, color: { argb: HDR_TXT } },
      align:  { vertical: "middle", ...align },
      border: { top: bThin(ACCENT), bottom: bNone(), left: bNone(), right: bNone() },
    });
  });
  catSheet.getRow(cTotR).height = 26;

  // Insight row
  const insightRow = cTotR + 1;
  catSheet.mergeCells(`B${insightRow}:G${insightRow}`);
  const topCat = catEntries[0];
  const insightText = topCat
    ? `Highest spend: ${topCat.name} at ${(totalExpenses > 0 ? (topCat.total/totalExpenses*100) : 0).toFixed(1)}% of total budget`
    : "";
  sc(catSheet.getCell(`B${insightRow}`), {
    v: insightText, bg: WHITE,
    font:  { italic: true, size: 10, color: { argb: "FFaaaaaa" } },
    align: { horizontal: "left", indent: 1 },
    border: noB(),
  });
  catSheet.getRow(insightRow).height = 22;

  catSheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 };

  // ── Stream ────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="StatementFlow_${fileDate}.xlsx"`,
      "Content-Length":      String(buffer.byteLength),
    },
  });
}
