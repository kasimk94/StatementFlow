import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";

const GOLD   = "FFC9A84C";
const WHITE  = "FFFFFFFF";
const DARK   = "FF080C14";
const LIGHT  = "FFF5F0E8";
const GREY   = "FF8A9BB5";
const GREEN  = "FF10B981";
const RED    = "FFEF4444";
const HDR_BG = "FF0D1117";

const solidFill = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const noB       = ()   => ({ top: { style: "none" }, left: { style: "none" }, bottom: { style: "none" }, right: { style: "none" } });
const botThin   = ()   => ({ top: { style: "none" }, left: { style: "none" }, bottom: { style: "thin", color: { argb: "FF1E2A3A" } }, right: { style: "none" } });

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function parseDate(s) {
  if (!s) return null;
  const m1 = String(s).match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (m1) { const mi = MONTHS.findIndex(mo => m1[2].toLowerCase().startsWith(mo.toLowerCase())); if (mi >= 0) return new Date(+m1[3], mi, +m1[1]); }
  const m2 = String(s).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return new Date(+m2[3], +m2[2]-1, +m2[1]);
  const d = new Date(s); return isNaN(d) ? null : d;
}
function fmtDateStr(d) {
  if (!d) return "";
  return `${String(d.getDate()).padStart(2,"0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function writeSheetHeader(sheet, cols, bankName, subtitle) {
  sheet.mergeCells(`A1:${cols}1`);
  const r1 = sheet.getCell("A1");
  r1.value = `MoneySorted — ${bankName}`;
  r1.font  = { name: "Calibri", bold: true, size: 16, color: { argb: GOLD } };
  r1.fill  = solidFill(DARK); r1.alignment = { vertical: "middle", indent: 1 }; r1.border = noB();
  sheet.getRow(1).height = 34;

  sheet.mergeCells(`A2:${cols}2`);
  const r2 = sheet.getCell("A2");
  r2.value = subtitle;
  r2.font  = { name: "Calibri", size: 10, italic: true, color: { argb: GREY } };
  r2.fill  = solidFill(DARK); r2.alignment = { vertical: "middle", indent: 1 }; r2.border = noB();
  sheet.getRow(2).height = 20;

  sheet.mergeCells(`A3:${cols}3`);
  sheet.getCell("A3").fill   = solidFill(DARK);
  sheet.getCell("A3").border = { bottom: { style: "medium", color: { argb: GOLD } } };
  sheet.getRow(3).height = 6;

  sheet.mergeCells(`A4:${cols}4`);
  sheet.getCell("A4").fill = solidFill(DARK);
  sheet.getRow(4).height   = 8;
}

function writeTxSheet(wb, sheetName, transactions, bankLabel) {
  const sheet = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
  sheet.properties.defaultRowHeight = 20;

  const COLS = "F";
  writeSheetHeader(sheet, COLS, bankLabel, `Transactions — ${transactions.length} records`);

  // Column widths
  sheet.getColumn(1).width = 16; // Date
  sheet.getColumn(2).width = 36; // Description
  sheet.getColumn(3).width = 22; // Category
  sheet.getColumn(4).width = 14; // Amount
  sheet.getColumn(5).width = 12; // Type
  sheet.getColumn(6).width = 12; // Balance

  // Header row
  const HDR = ["Date", "Description", "Category", "Amount (£)", "Type", "Balance (£)"];
  const hRow = sheet.getRow(5);
  hRow.height = 22;
  HDR.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: "Aptos", bold: true, size: 10, color: { argb: GOLD } };
    cell.fill  = solidFill("FF0D1117");
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
    cell.alignment = { vertical: "middle", horizontal: i === 3 || i === 5 ? "right" : "left" };
  });

  transactions.forEach((t, idx) => {
    const row = sheet.getRow(idx + 6);
    row.height = 18;
    const amt  = Number(t.amount) || 0;
    const d    = parseDate(t.date);
    const isAlt = idx % 2 === 1;
    const rowBg = isAlt ? "FF0A0F17" : "FF080C14";

    function sc(colIdx, val, opts = {}) {
      const cell = row.getCell(colIdx);
      cell.value = val;
      cell.font  = { name: "Aptos", size: 10, color: { argb: opts.color || LIGHT }, ...opts.font };
      cell.fill  = solidFill(rowBg);
      cell.border = botThin();
      cell.alignment = { vertical: "middle", horizontal: opts.align || "left" };
      if (opts.fmt) cell.numFmt = opts.fmt;
    }

    sc(1, d || t.date || "",   { color: GREY });
    sc(2, t.description || "", {});
    sc(3, t.category || "—",   { color: GREY });
    sc(4, Math.abs(amt),       { color: amt >= 0 ? GREEN : RED, align: "right", fmt: '"£"#,##0.00', font: { bold: true } });
    sc(5, amt >= 0 ? "Credit" : "Debit", { color: amt >= 0 ? GREEN : RED });
    sc(6, t.balance != null ? Number(t.balance) : "", { align: "right", fmt: '"£"#,##0.00', color: GREY });
  });

  // Freeze header
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5, showGridLines: false }];
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") || "";
  const ids = idsParam.split(",").filter(Boolean);

  if (!ids.length) {
    return NextResponse.json({ error: "No statement IDs provided" }, { status: 400 });
  }

  // Fetch all statements — verify ownership
  const statements = await prisma.statement.findMany({
    where: { id: { in: ids }, userId: session.user.id },
    select: { id: true, bankName: true, dateFrom: true, dateTo: true, rawData: true },
  });

  if (!statements.length) {
    return NextResponse.json({ error: "No statements found" }, { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "MoneySorted";
  wb.created = new Date();

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const summary = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  summary.properties.defaultRowHeight = 20;
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 18;
  summary.getColumn(3).width = 18;
  summary.getColumn(4).width = 16;
  summary.getColumn(5).width = 16;

  writeSheetHeader(summary, "E", "Combined Analysis", `${statements.length} statements · Generated ${new Date().toLocaleDateString("en-GB")}`);

  // Table headers
  const sumHdr = summary.getRow(5);
  sumHdr.height = 22;
  ["Bank", "Period", "Money In", "Money Out", "Transactions"].forEach((h, i) => {
    const cell = sumHdr.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: "Aptos", bold: true, size: 10, color: { argb: GOLD } };
    cell.fill  = solidFill("FF0D1117");
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
    cell.alignment = { vertical: "middle", horizontal: i >= 2 ? "right" : "left" };
  });

  let grandIn = 0, grandOut = 0, grandTxns = 0;
  statements.forEach((st, idx) => {
    const txns   = st.rawData?.transactions || [];
    let totalIn = 0, totalOut = 0, count = 0;
    txns.forEach(t => {
      if (t.exclude || t.isInternal) return;
      const a = Number(t.amount) || 0;
      if (a >= 0) totalIn  += a;
      else        totalOut += Math.abs(a);
      count++;
    });
    grandIn  += totalIn;
    grandOut += totalOut;
    grandTxns += count;

    const row = summary.getRow(idx + 6);
    row.height = 18;
    const bg = idx % 2 === 1 ? "FF0A0F17" : "FF080C14";

    const cells = [
      [1, st.bankName || "Unknown", { color: LIGHT, font: { bold: true } }],
      [2, st.dateFrom && st.dateTo ? `${st.dateFrom} – ${st.dateTo}` : "—", { color: GREY }],
      [3, totalIn,  { color: GREEN, align: "right", fmt: '"£"#,##0.00' }],
      [4, totalOut, { color: RED,   align: "right", fmt: '"£"#,##0.00' }],
      [5, count,    { color: GOLD,  align: "right" }],
    ];
    cells.forEach(([col, val, opts]) => {
      const cell = row.getCell(col);
      cell.value = val;
      cell.font  = { name: "Aptos", size: 10, color: { argb: opts.color || LIGHT }, ...opts.font };
      cell.fill  = solidFill(bg);
      cell.border = botThin();
      cell.alignment = { vertical: "middle", horizontal: opts.align || "left" };
      if (opts.fmt) cell.numFmt = opts.fmt;
    });
  });

  // Grand total row
  const totRow = summary.getRow(statements.length + 6);
  totRow.height = 22;
  [[1, "TOTAL", { color: GOLD, font: { bold: true } }],
   [3, grandIn,  { color: GREEN, align: "right", fmt: '"£"#,##0.00', font: { bold: true } }],
   [4, grandOut, { color: RED,   align: "right", fmt: '"£"#,##0.00', font: { bold: true } }],
   [5, grandTxns,{ color: GOLD,  align: "right", font: { bold: true } }],
  ].forEach(([col, val, opts]) => {
    const cell = totRow.getCell(col);
    cell.value = val;
    cell.font  = { name: "Aptos", size: 10, color: { argb: opts.color || LIGHT }, ...opts.font };
    cell.fill  = solidFill("FF0D1117");
    cell.border = { top: { style: "medium", color: { argb: GOLD } } };
    cell.alignment = { vertical: "middle", horizontal: opts.align || "left" };
    if (opts.fmt) cell.numFmt = opts.fmt;
  });

  // ── Per-bank transaction sheets ────────────────────────────────────────────
  statements.forEach(st => {
    const bank  = st.bankName || "Unknown";
    const txns  = st.rawData?.transactions || [];
    const label = bank.length > 26 ? bank.slice(0, 26) : bank;
    writeTxSheet(wb, label, txns, bank);
  });

  // ── All Transactions sheet ─────────────────────────────────────────────────
  const allTxns = [];
  statements.forEach(st => {
    const bank = st.bankName || "Unknown";
    (st.rawData?.transactions || []).forEach(t => allTxns.push({ ...t, _bank: bank }));
  });
  allTxns.sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
    return db - da;
  });

  const allSheet = wb.addWorksheet("All Transactions", { views: [{ showGridLines: false }] });
  allSheet.properties.defaultRowHeight = 20;

  const ACOLS = "G";
  writeSheetHeader(allSheet, ACOLS, "All Transactions", `${allTxns.length} total transactions across ${statements.length} statements`);

  allSheet.getColumn(1).width = 16;
  allSheet.getColumn(2).width = 16;
  allSheet.getColumn(3).width = 34;
  allSheet.getColumn(4).width = 22;
  allSheet.getColumn(5).width = 14;
  allSheet.getColumn(6).width = 12;
  allSheet.getColumn(7).width = 12;

  const aHdr = allSheet.getRow(5);
  aHdr.height = 22;
  ["Date", "Bank", "Description", "Category", "Amount (£)", "Type", "Balance (£)"].forEach((h, i) => {
    const cell = aHdr.getCell(i + 1);
    cell.value = h;
    cell.font  = { name: "Aptos", bold: true, size: 10, color: { argb: GOLD } };
    cell.fill  = solidFill("FF0D1117");
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
    cell.alignment = { vertical: "middle", horizontal: i >= 4 ? "right" : "left" };
  });

  allTxns.forEach((t, idx) => {
    const row  = allSheet.getRow(idx + 6);
    row.height = 18;
    const amt  = Number(t.amount) || 0;
    const d    = parseDate(t.date);
    const bg   = idx % 2 === 1 ? "FF0A0F17" : "FF080C14";

    [[1, d || t.date || "",   GREY,  "left",  null,           {}],
     [2, t._bank || "—",      GOLD,  "left",  null,           {}],
     [3, t.description || "", LIGHT, "left",  null,           {}],
     [4, t.category || "—",   GREY,  "left",  null,           {}],
     [5, Math.abs(amt),       amt >= 0 ? GREEN : RED, "right", '"£"#,##0.00', { bold: true }],
     [6, amt >= 0 ? "Credit" : "Debit", amt >= 0 ? GREEN : RED, "left", null, {}],
     [7, t.balance != null ? Number(t.balance) : "", GREY, "right", '"£"#,##0.00', {}],
    ].forEach(([col, val, color, align, fmt, font]) => {
      const cell = row.getCell(col);
      cell.value = val;
      cell.font  = { name: "Aptos", size: 10, color: { argb: color }, ...font };
      cell.fill  = solidFill(bg);
      cell.border = botThin();
      cell.alignment = { vertical: "middle", horizontal: align };
      if (fmt) cell.numFmt = fmt;
    });
  });

  allSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 5, showGridLines: false }];

  // ── Return workbook ────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `MoneySorted-Combined-${new Date().toISOString().slice(0,10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
