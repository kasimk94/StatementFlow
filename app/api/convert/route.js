import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// PDF vision parsing — sends raw PDF buffer to claude-sonnet-4-6 as base64
// ---------------------------------------------------------------------------
async function parseWithClaude(buffer) {
  const base64 = buffer.toString('base64');

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        },
        {
          type: "text",
          text: `You are a senior Financial Auditor. Extract every real transaction from this bank statement PDF with maximum accuracy.

EXTRACTION RULES:
1. Read the PDF visually — identify the exact column layout (some banks use separate IN/OUT columns, others use a single signed amount column).
2. Every transaction MUST have: date, description, amount (always a positive number), type ("debit" or "credit").
3. Credits = money coming IN (salary, transfers in, refunds, cashback).
4. Debits = money going OUT (purchases, bill payments, ATM withdrawals).
5. SKIP: internal pot/savings transfers (Monzo "Transfer from Pot", "Transfer to Pot"), balance rows, page headers, bank registration text, running-balance numbers.
6. Clean descriptions: strip payment-type prefixes (CONTACTLESS, FASTER PAYMENT, DD, SO, VIS, CR, BACS, CHQ, FP, etc.) — keep only the merchant or person name.
7. Multi-page statements: extract ALL transactions from ALL pages — do NOT stop at page 1.
8. Opening balance: the balance figure shown at the very start of the statement period.
9. Closing balance: the balance figure shown at the very end of the statement period.
10. Do NOT invent or hallucinate transactions. Only extract what is clearly printed.
11. If the same merchant appears on the same date with the same amount more than once, include each occurrence separately (genuine repeat transactions happen).
12. Assign your confidence (0–100) in the accuracy of your extraction. Deduct points for: scanned/image PDFs, illegible text, ambiguous column layout, missing dates, mixed currencies.

Return ONLY a JSON object — no markdown, no explanation:
{
  "confidence": 87,
  "bankDetected": "Barclays",
  "openingBalance": 1234.56,
  "closingBalance": 987.65,
  "totalTransactionsFound": 47,
  "warnings": ["Page 3 text quality low — some amounts may be misread"],
  "transactions": [
    {"date": "DD Mon YYYY", "description": "clean merchant name", "amount": 1.23, "type": "debit"}
  ]
}

Rules for the top-level fields:
- confidence: integer 0–100. Be honest — a scanned or blurry PDF should score 40–60.
- bankDetected: bank name string (e.g. "HSBC", "Barclays", "Monzo") or "Unknown".
- openingBalance: number or null if not found.
- closingBalance: number or null if not found.
- totalTransactionsFound: count of transactions you detected BEFORE any filtering.
- warnings: array of strings describing any issues encountered (empty array if none).`,
        },
      ],
    }],
  });

  const raw = response.content[0].text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const EMPTY = { bank: 'Unknown', transactions: [], confidence: 40, openingBalance: null, closingBalance: null, totalTransactionsFound: 0, warnings: ['Parser returned no usable data'], bankDetected: 'Unknown' };

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.transactions)) {
      return {
        bank:                  parsed.bankDetected || parsed.bank || 'Unknown',
        transactions:          parsed.transactions,
        confidence:            typeof parsed.confidence === 'number' ? parsed.confidence : 70,
        openingBalance:        parsed.openingBalance ?? null,
        closingBalance:        parsed.closingBalance ?? null,
        totalTransactionsFound: parsed.totalTransactionsFound ?? parsed.transactions.length,
        warnings:              Array.isArray(parsed.warnings) ? parsed.warnings : [],
        bankDetected:          parsed.bankDetected || parsed.bank || 'Unknown',
      };
    }
    // Fallback: if Claude returned a bare array
    if (Array.isArray(parsed)) {
      return { ...EMPTY, bank: 'Unknown', transactions: parsed, confidence: 50, warnings: ['Incomplete response — bank metadata missing'], totalTransactionsFound: parsed.length };
    }
    return EMPTY;
  } catch(e) {
    // Salvage partial transactions array from within the object
    const txStart = raw.indexOf('"transactions"');
    const arrStart = txStart > -1 ? raw.indexOf('[', txStart) : raw.indexOf('[');
    if (arrStart > -1) {
      const lastBrace = raw.lastIndexOf('},');
      if (lastBrace > arrStart) {
        try {
          const partial = JSON.parse(raw.slice(arrStart, lastBrace + 1) + ']');
          if (Array.isArray(partial) && partial.length > 0) {
            console.log("Salvaged", partial.length, "transactions");
            return { ...EMPTY, transactions: partial, confidence: 45, warnings: ['Response was truncated — results may be incomplete'], totalTransactionsFound: partial.length };
          }
        } catch(e2) {}
      }
    }
    console.error("Parse failed:", e.message);
    return EMPTY;
  }
}

// ---------------------------------------------------------------------------
// Validation — checks Claude's parse result for common failure modes
// ---------------------------------------------------------------------------
function validateParse(parseResult, transactions) {
  const errors = [];
  const warnings = [];
  const confidence = typeof parseResult.confidence === 'number' ? parseResult.confidence : 50;

  // 1. Low confidence
  if (confidence < 70) {
    errors.push(`Low parser confidence (${confidence}%). The statement may be a scanned image or low-quality PDF. Results may be incomplete or inaccurate — please review carefully before exporting.`);
  }

  // 2. Balance reconciliation
  if (parseResult.openingBalance != null && parseResult.closingBalance != null) {
    const txCredits  = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + Math.abs(t.amount), 0);
    const txDebits   = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(t.amount), 0);
    const calcClose  = parseFloat((parseResult.openingBalance + txCredits - txDebits).toFixed(2));
    const discrepancy = Math.abs(calcClose - parseResult.closingBalance);
    if (discrepancy > 50) {
      errors.push(`Balance discrepancy of £${discrepancy.toFixed(2)} detected. Expected closing balance £${parseResult.closingBalance.toFixed(2)} but transactions sum to £${calcClose.toFixed(2)}. Some transactions may be missing.`);
    } else if (discrepancy > 10) {
      warnings.push(`Minor balance discrepancy of £${discrepancy.toFixed(2)} detected. Please review all transactions before exporting.`);
    }
  }

  // 3. Zero-amount transactions
  const zeroCount = transactions.filter(t => Math.abs(t.amount) < 0.001).length;
  if (zeroCount > 0) {
    warnings.push(`${zeroCount} transaction${zeroCount !== 1 ? 's' : ''} with a £0.00 amount were detected. These may be parsing errors and have been included for review.`);
  }

  // 4. Duplicate detection (same date + description + amount)
  const seen = new Map();
  let dupCount = 0;
  for (const t of transactions) {
    const key = `${t.date}||${(t.description || '').toLowerCase()}||${Math.abs(t.amount).toFixed(2)}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) === 2) dupCount++;
  }
  if (dupCount > 0) {
    warnings.push(`${dupCount} potential duplicate transaction${dupCount !== 1 ? 's' : ''} detected (same date, description, and amount). Please verify these are genuine repeats.`);
  }

  // 5. Too few transactions
  if (transactions.length < 3) {
    errors.push(`Only ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} extracted. This is likely a parsing failure — please check the uploaded file is a valid bank statement.`);
  }

  // Surface any warnings Claude itself raised
  if (Array.isArray(parseResult.warnings)) {
    for (const w of parseResult.warnings) {
      if (w && !warnings.includes(w)) warnings.push(w);
    }
  }

  return {
    isValid:    errors.length === 0,
    confidence,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// POST /api/convert  — Claude vision parses PDF directly, regex categorises
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    console.log("=== PDF CONVERSION STARTED ===");

    // ── 0. Upload limit check ───────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (user && user.plan === "FREE" && user.uploadCount >= 1) {
        return NextResponse.json(
          { error: "You have reached the 1 upload limit on the free plan. Upgrade to Pro for unlimited uploads." },
          { status: 403 }
        );
      }
    } else {
      // Guest: check cookie-based counter (handled client-side — server trusts session)
      // No strict server enforcement for guests; rely on client-side gate
    }

    // ── 1. Read form data ───────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") || formData.get("pdf");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log("File received:", file.name, file.size, "bytes");

    // ── 2. Size check ───────────────────────────────────────────────────────
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Please upload a PDF under 5 MB." },
        { status: 400 }
      );
    }

    // ── 3. Send PDF buffer directly to Sonnet vision ───────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parseWithClaude(buffer);
    const { bank: bankName, transactions: parsed, confidence: parseConfidence, openingBalance: parseOpeningBalance, closingBalance: parseClosingBalance, totalTransactionsFound, bankDetected } = parseResult;
    console.log("Bank detected:", bankName, "| Confidence:", parseConfidence);

    // ── 4. PDF summary totals (not available without text extraction) ────────
    const pdfSummary = { moneyIn: null, moneyOut: null, startBalance: null, endBalance: null, overdraftLimit: null };
    const overdraftLimit = 500;

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transactions found in this statement. Please check the file is a valid bank statement.",
        },
        { status: 400 }
      );
    }

    // ── 6b. Load merchant memory for logged-in users ───────────────────────
    let merchantMemory = new Map(); // merchantKey → category
    if (session?.user?.id) {
      try {
        const memories = await prisma.merchantCategory.findMany({
          where: { userId: session.user.id },
          select: { merchantKey: true, category: true },
        });
        for (const m of memories) merchantMemory.set(m.merchantKey, m.category);
        console.log(`Loaded ${merchantMemory.size} merchant memories`);
      } catch (e) {
        console.warn("Merchant memory load failed:", e.message);
      }
    }

    // ── 7. Categorise + normalise via local regex engine (zero cost) ─────────
    const filteredParsed = parsed.filter(t => {
      const d = (t.description || '').toLowerCase();
      return !d.includes('transfer from pot') &&
             !d.includes('transfer to pot') &&
             d !== 'withdrawal' &&
             d !== 'deposit';
    });

    console.log(`Filtered ${parsed.length - filteredParsed.length} pot transfers. Remaining: ${filteredParsed.length}`);

    const rawTransactions = filteredParsed
      .map((t) => {
        const amount =
          typeof t.amount === "number"
            ? t.amount
            : parseFloat(String(t.amount).replace(/[^0-9.\-]/g, "")) || 0;
        // Force unpaid DDs and returned transactions to credit — bank returned the money
        const isUnpaidReturn = /unpaid direct debit|unpaid dd|returned payment/i.test(t.description || "");
        const type = isUnpaidReturn
          ? "credit"
          : (t.type || (amount >= 0 ? "credit" : "debit"));
        const signedAmount = type === "debit" ? -Math.abs(amount) : Math.abs(amount);
        const { category: autoCategory, exclude, isInternal = false, note = null } =
          categoriseTransaction(t.description, signedAmount, type);
        const cleaned = cleanDescription(t.description || "Transaction");
        // Merchant memory override
        const merchantKey = (t.description || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const category = merchantMemory.get(merchantKey) || autoCategory;
        const vat = type === "debit"
          ? detectVAT(cleaned, category, Math.abs(signedAmount))
          : { vatReclaimable: false, vatAmount: 0, vatConfidence: "excluded", vatNote: "Not applicable" };
        const { cleanMerchant, viaProcessor } = extractCleanMerchant(t.description || "");
        const normDate = normaliseDate(t.date);
        return {
          date:              normDate,
          dateFormatted:     formatDateYYYYMMDD(normDate),
          description:       cleaned,
          amount:            signedAmount,
          type,
          category,
          merchantKey,
          exclude,
          isInternal,
          excludeFromTotals: false,
          reversalLinked:    false,
          reversalNote:      note,
          cleanMerchant,
          viaProcessor,
          debit:  type === "debit"   ? signedAmount : null,
          credit: type === "credit"  ? signedAmount : null,
          ...vat,
        };
      })
      .filter((t) => t.date && !isNaN(t.amount));

    if (rawTransactions.length === 0) {
      return NextResponse.json(
        { error: "Could not normalise any transactions. Please try again." },
        { status: 400 }
      );
    }

    // ── 7b. Safety filter — strip any pot transfers Claude missed ──────────
    const cleanedTransactions = rawTransactions.filter(t =>
      !/(transfer (from|to) pot)/i.test(t.description || "")
    );

    // ── 8. Apply reversal / refund netting + transactionType ───────────────
    const transactions = applyReversals(cleanedTransactions).map(tx => ({
      ...tx,
      transactionType: classifyTransactionType(tx),
    }));

    // ── 8b. Real income / spending (excludes transfers & adjustments) ───────
    const realIncome = parseFloat(
      transactions
        .filter(tx => tx.type === "credit" && !tx.isInternal && !tx.isAdjustment && !tx.excludeFromTotals && tx.category !== "Transfers Received")
        .reduce((sum, tx) => sum + tx.amount, 0)
        .toFixed(2)
    );
    const realSpending = parseFloat(
      transactions
        .filter(tx => tx.type === "debit" && !tx.isInternal && !tx.isAdjustment && !tx.excludeFromTotals && tx.category !== "Transfers Sent")
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
        .toFixed(2)
    );

    // ── 9. Calculate totals ─────────────────────────────────────────────────
    const internalTransferTotal = transactions
      .filter((t) => t.isInternal && t.type === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const reversalsCount = transactions.filter(
      (t) => t.reversalLinked && t.type === "credit"
    ).length;

    const totalIncome =
      pdfSummary.moneyIn ??
      transactions
        .filter((t) => t.type === "credit" && !t.exclude)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalExpenses =
      pdfSummary.moneyOut ??
      transactions
        .filter((t) => t.type === "debit" && !t.exclude)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const netBalance =
      pdfSummary.endBalance !== null && pdfSummary.endBalance !== undefined
        ? pdfSummary.endBalance
        : totalIncome - totalExpenses;

    console.log(
      "Totals → income:", totalIncome,
      "expenses:", totalExpenses,
      "net:", netBalance
    );

    const { trueSpending, trueIncome, categories, liquidity } =
      calculateTrueSpending(transactions, netBalance, overdraftLimit);

    const period = null;

    // ── VAT summary ─────────────────────────────────────────────────────────
    const vatBreakdown = {};
    transactions
      .filter(t => t.vatReclaimable && t.type === "debit")
      .forEach(t => {
        vatBreakdown[t.category] = parseFloat(
          ((vatBreakdown[t.category] || 0) + t.vatAmount).toFixed(2)
        );
      });
    const totalVATReclaimable = parseFloat(
      Object.values(vatBreakdown).reduce((s, v) => s + v, 0).toFixed(2)
    );
    const vatSummary = {
      totalReclaimable:  totalVATReclaimable,
      breakdown:         vatBreakdown,
      transactionCount:  transactions.filter(t => t.vatReclaimable).length,
    };

    // ── Validation ─────────────────────────────────────────────────────────
    const validation = validateParse(parseResult, rawTransactions);
    console.log("Validation:", JSON.stringify({ isValid: validation.isValid, confidence: validation.confidence, errors: validation.errors.length, warnings: validation.warnings.length }));

    console.log("=== CONVERSION SUCCESS ===", transactions.length, "transactions");

    // ── Increment upload count for logged-in users ─────────────────────────
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { uploadCount: { increment: 1 } },
      });
    }

    return NextResponse.json({
      transactions,
      totalIncome,
      totalExpenses,
      netBalance,
      startBalance:         parseOpeningBalance ?? pdfSummary.startBalance,
      endBalance:           parseClosingBalance ?? pdfSummary.endBalance,
      transactionCount:     transactions.length,
      confidence:           parseConfidence,
      bank:                 bankDetected || bankName,
      insights:             null,
      trueSpending,
      trueIncome,
      overdraftLimit,
      liquidity,
      internalTransferTotal,
      reversalsCount,
      categoryBreakdown:    categories,
      period,
      vatSummary,
      realIncome,
      realSpending,
      validation,
    });
  } catch (err) {
    console.error("=== CONVERSION FAILED ===", err.message, err.stack);
    return NextResponse.json(
      { error: "Unexpected error: " + err.message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Bank detection from raw extracted text
// ---------------------------------------------------------------------------
function detectBank(text) {
  const t = text.toLowerCase();
  if (t.includes("hsbc") || t.includes("hbukgb4141b") || t.includes("hsbc.co.uk")) return "HSBC";
  if (t.includes("srlggb2l") || t.includes("starlingbank.com") || t.includes("starling bank")) return "Starling Bank";
  if (t.includes("barclays"))                                    return "Barclays";
  if (t.includes("monzo.com") || t.includes("monzgb2l") || t.includes("monzo bank limited") || t.includes("monzo")) return "Monzo";
  if (t.includes("lloyds"))                                      return "Lloyds";
  if (t.includes("natwest"))                                     return "NatWest";
  if (t.includes("nationwide"))                                  return "Nationwide";
  if (t.includes("santander"))                                   return "Santander";
  if (t.includes("halifax"))                                     return "Halifax";
  if (t.includes("first direct"))                                return "First Direct";
  if (t.includes("revolut"))                                     return "Revolut";
  if (t.includes("chase"))                                       return "Chase";
  if (t.includes("metro bank"))                                  return "Metro Bank";
  if (t.includes("co-operative bank") || t.includes("co op bank")) return "Co-op Bank";
  if (t.includes("virgin money"))                                return "Virgin Money";
  if (t.includes("tsb"))                                         return "TSB";
  return "Your Bank";
}

// ---------------------------------------------------------------------------
// Period extractor
// ---------------------------------------------------------------------------
function extractPeriod(rawText) {
  // "1 January 2024 to 31 January 2024"
  const range = rawText.match(
    /(\d{1,2}\s+\w+\s+\d{4})\s+to\s+(\d{1,2}\s+\w+\s+\d{4})/i
  );
  if (range) return { from: range[1], to: range[2] };

  // "January 2024 - February 2024" or "Jan 2024 – Feb 2024"
  const monthRange = rawText.match(
    /([A-Za-z]+\s+\d{4})\s*[-–]\s*([A-Za-z]+\s+\d{4})/
  );
  if (monthRange) return { from: monthRange[1], to: monthRange[2] };

  // "Statement date: DD/MM/YYYY"
  const stmtDate = rawText.match(
    /statement\s+(?:date|period)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
  );
  if (stmtDate) return { from: null, to: stmtDate[1] };

  return null;
}

// ---------------------------------------------------------------------------
// Transaction parser — regex-based, no AI, no API calls
// ---------------------------------------------------------------------------
function guessYear(rawText) {
  const m = rawText.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MONTH_MAP = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

// Match[1]=day, match[2]=month (name or number), match[3]=year (optional)
function parseDateFromMatch(match, defaultYear) {
  const day = parseInt(match[1], 10);
  const yearRaw = match[3] ? parseInt(match[3], 10) : defaultYear;
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;

  // Named month (abbreviated or full — take first 3 chars)
  const monthKey = (match[2] || "").toLowerCase().substring(0, 3);
  const monthNum = MONTH_MAP[monthKey];
  if (monthNum && day >= 1 && day <= 31) {
    return `${String(day).padStart(2, "0")} ${MONTHS[monthNum - 1]} ${year}`;
  }

  // Numeric month (from slash-format dates)
  const numericMonth = parseInt(match[2], 10);
  if (numericMonth >= 1 && numericMonth <= 12 && day >= 1 && day <= 31) {
    return `${String(day).padStart(2, "0")} ${MONTHS[numericMonth - 1]} ${year}`;
  }

  return null;
}

// Named-month date at line start: "15 Mar", "15 Mar 24", "15 March 2024"
const DATE_NAMED =
  /^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(\d{2,4})?/i;

// Slash/dash date at line start: "15/03/2024", "15-03-24"
const DATE_SLASH = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;

// Lines that are headers / summary rows — skip these
const SKIP_LINE =
  /^(date|details|description|payments?\s*out|payments?\s*in|money\s*out|money\s*in|paid\s*in|paid\s*out|balance|total|opening|closing|brought\s*forward|carried\s*forward|account\s*(number|name)|sort\s*code|statement|page\s*\d|continued|bacs\s*ref|faster\s*payment|standing\s*order)/i;

function parseTransactions(rawText, bankName) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const defaultYear = guessYear(rawText);
  const transactions = [];
  let prevBalance = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Must start with a recognisable date
    const dm = line.match(DATE_NAMED) || line.match(DATE_SLASH);
    if (!dm) continue;

    // Skip header / summary rows even if they start with a date-like string
    if (SKIP_LINE.test(line)) continue;

    const date = parseDateFromMatch(dm, defaultYear);
    if (!date) continue;

    // ── Continuation line handling ──────────────────────────────────────
    // If next line has no date and no amounts it is likely a wrapped description
    let fullLine = line;
    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      const nextHasDate = DATE_NAMED.test(next) || DATE_SLASH.test(next);
      const nextHasAmt  = /£?[\d,]+\.\d{2}/.test(next);
      if (!nextHasDate && !nextHasAmt && next.length < 80) {
        fullLine = line + " " + next;
        i++; // consume continuation line
      }
    }

    // ── Extract all monetary amounts from the full line ─────────────────
    const amountMatches = [...fullLine.matchAll(/£?([\d,]+\.\d{2})/g)];
    const amounts = amountMatches.map((m) => parseFloat(m[1].replace(/,/g, "")));

    if (amounts.length === 0) continue;

    // Convention: last amount = running balance, second-to-last = tx amount
    let txAmount, balance;
    if (amounts.length >= 2) {
      balance  = amounts[amounts.length - 1];
      txAmount = amounts[amounts.length - 2];
    } else {
      // Only one amount — treat as tx amount, balance unknown
      txAmount = amounts[0];
      balance  = null;
    }

    // ── Extract description ─────────────────────────────────────────────
    let desc = fullLine;
    // Remove date prefix
    desc = desc
      .replace(/^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(\d{2,4})?\s*/i, "")
      .replace(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s*/, "");
    // Remove trailing amounts (right to left — do three passes to strip balance + tx amount)
    for (let r = 0; r < 3; r++) {
      desc = desc.replace(/\s*£?[\d,]+\.\d{2}\s*$/, "").trim();
    }
    // Drop any leading stray amount that survived
    desc = desc.replace(/^£?[\d,]+\.\d{2}\s*/, "").trim();

    if (!desc || desc.length < 2) continue;

    // ── Determine debit / credit ────────────────────────────────────────
    let type = "debit"; // safe default

    if (balance !== null && prevBalance !== null) {
      const delta = balance - prevBalance;
      if (Math.abs(delta - txAmount) < 0.02)       type = "credit"; // balance rose by txAmount
      else if (Math.abs(delta + txAmount) < 0.02)  type = "debit";  // balance fell by txAmount
      else {
        // Delta doesn't cleanly match — fall back to description keywords
        type = /received\s*from|salary|wages|hmrc|child benefit|tax credit|refund|cashback|interest paid/i.test(desc)
          ? "credit"
          : "debit";
      }
    } else {
      // No previous balance to compare — use description keywords
      type =
        /received\s*from|salary|wages|hmrc|child benefit|tax credit|refund|cashback|interest paid/i.test(desc)
          ? "credit"
          : "debit";
    }

    prevBalance = balance;

    transactions.push({
      date,
      description: desc,
      amount: type === "debit" ? -txAmount : txAmount,
      type,
    });
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// Date formatter — "DD Mon YYYY" → "YYYY-MM-DD"
// ---------------------------------------------------------------------------
function formatDateYYYYMMDD(dateStr) {
  try {
    const parts = String(dateStr || "").toLowerCase().split(" ");
    if (parts.length >= 3) {
      const day   = parts[0].padStart(2, "0");
      const month = String(MONTH_MAP[parts[1]] || 1).padStart(2, "0");
      const year  = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  } catch { return dateStr; }
}

// ---------------------------------------------------------------------------
// Clean merchant extractor — strips processor prefixes, expands truncations
// ---------------------------------------------------------------------------
function extractCleanMerchant(rawDescription) {
  let clean = cleanDescription(rawDescription);

  const processors = [
    { pattern: /^paypal\s*\*?\s*/i, label: "PayPal" },
    { pattern: /^stripe\s*\*?\s*/i, label: "Stripe" },
    { pattern: /^sumup\s*\*?\s*/i,  label: "SumUp"  },
    { pattern: /^sq\s*\*?\s*/i,     label: "Square" },
  ];
  let viaProcessor = null;
  for (const p of processors) {
    if (p.pattern.test(clean)) {
      viaProcessor = p.label;
      clean = clean.replace(p.pattern, "").trim();
      break;
    }
  }

  const expansions = {
    "pennyappea":         "Penny Appeal",
    "humanappea":         "Human Appeal",
    "muslimglob":         "Muslim Global",
    "argosdirec":         "Argos Direct",
    "asdastores":         "Asda Stores",
    "islamicrel":         "Islamic Relief",
    "rci financial serv": "RCI Financial Services",
    "barclays prtnr fin": "Barclays Partner Finance",
    "amznmktplace":       "Amazon Marketplace",
    "amazon.co.uk":       "Amazon UK",
    "amazon.com":         "Amazon",
  };
  const lowerClean = clean.toLowerCase();
  for (const [truncated, full] of Object.entries(expansions)) {
    if (lowerClean.includes(truncated)) { clean = full; break; }
  }

  clean = clean
    .replace(/\s+\d{3}-\d{6,}/g, "")
    .replace(/\s+ref:?\s*\S+/gi, "")
    .replace(/\s+on \d{1,2} \w+/gi, "")
    .replace(/\*\w+/g, "")
    .trim();

  clean = clean.split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return { cleanMerchant: clean || rawDescription, viaProcessor };
}

// ---------------------------------------------------------------------------
// Transaction type classifier
// ---------------------------------------------------------------------------
function classifyTransactionType(tx) {
  if (tx.isInternal)                             return "Internal Transfer";
  if (tx.reversalLinked || tx.excludeFromTotals) return "Reversal/Adjustment";
  if (tx.vatReclaimable)                         return "Business Expense";
  if (tx.type === "credit")                      return "Income";
  return "Transaction";
}

// ---------------------------------------------------------------------------
// FIX 2 — Description cleaner (multi-bank prefix stripping)
// ---------------------------------------------------------------------------
function cleanDescription(desc) {
  return (desc || "")
    // Barclays prefixes
    .replace(/^Card Payment to\s*/i, "")
    .replace(/^Bill Payment to\s*/i, "")
    .replace(/^Direct Debit to\s*/i, "")
    .replace(/^Cash Machine Withdrawal at\s*/i, "")
    .replace(/^Cash Withdrawal at\s*/i, "")
    .replace(/^Received From\s*/i, "")
    .replace(/^Refund From\s*/i, "")
    // HSBC prefixes
    .replace(/^VIS\s+/i, "")
    .replace(/^VISA\s+/i, "")
    // NatWest / RBS prefixes
    .replace(/^PURCHASE\s+/i, "")
    .replace(/^CONTACTLESS\s+/i, "")
    // Monzo / Starling (usually clean but just in case)
    .replace(/^Payment to\s*/i, "")
    .replace(/^Transfer to\s*/i, "")
    .replace(/^Transfer from\s*/i, "")
    // Universal suffixes
    .replace(/\s+On \d{1,2} \w{3}(\s+\d{4})?$/i, "") // "On 13 Mar"
    .replace(/\s+\d{2}\/\d{2}\/\d{4}$/i, "")          // trailing date
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// FIX 1 — Statement summary extractor (Barclays + fallback patterns)
// ---------------------------------------------------------------------------
function extractStatementTotals(rawText) {
  const moneyInMatch   = rawText.match(/Money in\s+£?([\d,]+\.?\d*)/i);
  const moneyOutMatch  = rawText.match(/Money out\s+£?([\d,]+\.?\d*)/i);
  const startBalMatch  = rawText.match(/Start balance\s+-?£?([\d,]+\.?\d*)/i);
  const endBalMatch    = rawText.match(/End balance\s+-?£?([\d,]+\.?\d*)/i);
  const overdraftMatch = rawText.match(
    /(?:Arranged )?[Oo]verdraft(?:\s+limit)?\s+£?([\d,]+\.?\d*)/i
  );

  const parseAmt = (match, raw, label) => {
    if (!match) return null;
    const sign = raw.includes(`${label} -`) ? -1 : 1;
    return sign * parseFloat(match[1].replace(/,/g, ""));
  };

  // Fallback patterns for other banks
  const fallbackIn = moneyInMatch
    ? null
    : rawText.match(/total\s+money\s+in[:\s]+£?([\d,]+\.?\d*)/i) ||
      rawText.match(/total\s+credits?[:\s]+£?([\d,]+\.?\d*)/i) ||
      rawText.match(/paid\s+in[:\s]+£?([\d,]+\.?\d*)/i);

  const fallbackOut = moneyOutMatch
    ? null
    : rawText.match(/total\s+money\s+out[:\s]+£?([\d,]+\.?\d*)/i) ||
      rawText.match(/total\s+debits?[:\s]+£?([\d,]+\.?\d*)/i) ||
      rawText.match(/paid\s+out[:\s]+£?([\d,]+\.?\d*)/i);

  return {
    moneyIn:
      moneyInMatch
        ? parseFloat(moneyInMatch[1].replace(/,/g, ""))
        : fallbackIn
        ? parseFloat(fallbackIn[1].replace(/,/g, ""))
        : null,
    moneyOut:
      moneyOutMatch
        ? parseFloat(moneyOutMatch[1].replace(/,/g, ""))
        : fallbackOut
        ? parseFloat(fallbackOut[1].replace(/,/g, ""))
        : null,
    startBalance: parseAmt(startBalMatch, rawText, "Start balance"),
    endBalance:   parseAmt(endBalMatch,   rawText, "End balance"),
    overdraftLimit: overdraftMatch
      ? parseFloat(overdraftMatch[1].replace(/,/g, ""))
      : null,
  };
}

// ---------------------------------------------------------------------------
// VAT detection — estimates reclaimable VAT on debit transactions
// ---------------------------------------------------------------------------
function detectVAT(description, category, amount) {
  const vatReclaimableCategories = [
    "Online Shopping", "High Street", "Subscriptions & Streaming",
    "Travel & Transport", "Health & Fitness", "Entertainment & Leisure",
    "Eating Out", "Direct Debits", "Finance & Bills",
  ];
  const nonVatCategories = [
    "Groceries", "Cash & ATM", "Transfers Sent", "Transfers Received",
    "Refunds", "Charity", "Rent & Mortgage",
  ];
  const vatRegisteredMerchants = [
    "amazon", "ebay", "argos", "currys", "apple", "google", "microsoft",
    "adobe", "spotify", "netflix", "uber", "deliveroo", "just eat",
    "costa", "starbucks", "tfl", "trainline", "bp", "shell", "esso",
    "vodafone", "ee", "o2", "bt ", "virgin media", "sky ", "puregym",
    "david lloyd", "boots", "superdrug", "hotel", "travelodge", "premier inn",
    "rci", "barclays partner", "barclaysprtnr", "cloud city", "maani",
  ];

  const desc = description.toLowerCase();

  if (nonVatCategories.includes(category)) {
    return { vatReclaimable: false, vatAmount: 0, vatConfidence: "excluded", vatNote: "Not VAT reclaimable" };
  }

  const knownVAT     = vatRegisteredMerchants.some(m => desc.includes(m));
  const categoryElig = vatReclaimableCategories.includes(category);

  if (knownVAT || categoryElig) {
    const vatAmount = parseFloat((amount * (20 / 120)).toFixed(2));
    return {
      vatReclaimable: true,
      vatAmount,
      vatConfidence: knownVAT ? "high" : "medium",
      vatNote:       knownVAT ? "VAT registered merchant" : "Likely VAT reclaimable",
    };
  }

  return { vatReclaimable: false, vatAmount: 0, vatConfidence: "unknown", vatNote: "VAT status unknown" };
}

// ---------------------------------------------------------------------------
// FIX 3+4+5 — Rebuilt categorisation engine (18-step, first-match-wins)
// ---------------------------------------------------------------------------
function looksLikePersonName(desc) {
  // Strip common payment prefixes
  const stripped = desc
    .replace(/^(bill payment to|payment to|received from|transfer to|transfer from)\s*/i, "")
    .trim();
  const words = stripped.split(/\s+/);
  // 2-4 words, each starts with capital, no digits
  return (
    words.length >= 2 &&
    words.length <= 4 &&
    words.every(w => /^[A-Z][a-zA-Z]{1,}$/.test(w)) &&
    !/\d/.test(stripped)
  );
}

function categoriseTransaction(rawDesc, amount, type) {
  const raw     = (rawDesc || "").toLowerCase();
  const cleaned = cleanDescription(rawDesc || "");

  // Step 0 — Monzo-specific rules (before all other checks)
  if (/\(p2p payment\)|\(faster payments\)/i.test(raw))
    return { category: type === "credit" ? "Transfers Received" : "Transfers Sent", exclude: false };
  if (/\bflex\b/i.test(raw) && type === "debit")
    return { category: "Finance & Bills", exclude: false };

  // Step 0a — Explicit credit transfer patterns (must beat all other rules)
  if (
    type === "credit" &&
    /received from|giro received|^giro\b/i.test(raw)
  )
    return { category: "Transfers Received", exclude: false };

  // "Ref: Car" or similar short-code credits are personal transfers
  if (type === "credit" && /\bref:\s*car\b/i.test(raw))
    return { category: "Transfers Received", exclude: false };

  // Step 0b — Explicit debit transfer patterns
  if (type === "debit" && /^bill payment to\b/i.test(rawDesc || ""))
    return { category: "Transfers Sent", exclude: false };

  // Step 1 — Refunds / Unpaid DDs (credits with refund keywords)
  if (
    type === "credit" &&
    /refund|reversal|reversed|unpaid|money back|returned/i.test(raw)
  ) {
    const note = /unpaid/i.test(raw) ? "Unpaid DD returned" : null;
    return { category: "Refunds", exclude: false, note };
  }

  // Step 2 — Internal transfers (flag with isInternal)
  if (/kasam khalid|kasim khalid|k khalid|ref:\s*monzo/i.test(raw))
    return { category: type === "credit" ? "Transfers Received" : "Transfers Sent", exclude: false, isInternal: true };

  // Step 3 — Transfers Received (specific known payees)
  if (
    type === "credit" &&
    /received from|ali z\b|hmrc|child benefit|samra kaleem/i.test(raw)
  )
    return { category: "Transfers Received", exclude: false };

  // Step 4 — Charity (BEFORE PayPal — catches truncated names like "pennyappea")
  if (
    /penny\s*appea|pennyappea|human\s*appea|humanappea|muslim\s*glob|muslimglob|islamic\s*relief|islamicrelief|islamic relief wor|islamic relief can|map\.org|www\.map|penny appeal|human appeal|muslim global|red cross|oxfam|cancer research|british heart|save the children|unicef|shelter|macmillan|wateraid|comic relief|justgiving|localgiving|charitycheckout/i.test(
      raw
    )
  )
    return { category: "Charity", exclude: false };

  // Step 5 — PayPal merchant detection (after charity check)
  const paypalMatch = cleaned.match(/paypal\s*\*?(\w+)/i);
  if (paypalMatch) {
    const merchant = paypalMatch[1].toLowerCase();
    if (
      /pennyappea|humanappea|muslimglob|islamicrel|appeal|relief|charity|found/i.test(
        merchant
      )
    )
      return { category: "Charity", exclude: false };
    if (/argos|argosdirec/i.test(merchant))
      return { category: "Online Shopping", exclude: false };
    if (/asda|tesco|sainsbury|morrisons/i.test(merchant))
      return { category: "Groceries", exclude: false };
    if (/ebay/i.test(merchant))
      return { category: "Online Shopping", exclude: false };
    return { category: "Online Shopping", exclude: false };
  }

  // Step 6 — Direct Debits (recurring / known DD merchants)
  if (
    /rci financial serv|rci financial|rcifinancial|barclays prtnr fin|barclays partner|barclaysprtnr|amazon prime|amazon.*prime|sky |virgin media|\bbt\b|talktalk|vodafone|\bee\b|\bo2\b|three mobile|council tax|tv licence|netflix|spotify|disney|apple\.com|google storage|icloud|microsoft 365|puregym|david lloyd|ovo energy|british gas|octopus|edf/i.test(
      raw
    )
  )
    return { category: "Direct Debits", exclude: false };

  // Step 7 — Groceries
  if (
    /tesco|sainsbury|asda|morrisons|waitrose|aldi|lidl|marks & spencer food|m&s food|co-op|coop|iceland|ocado|farmfoods|budgens|\bspar\b|whole foods|fresh and local|freshlocal|local farm/i.test(
      raw
    )
  )
    return { category: "Groceries", exclude: false };

  // Step 8 — Eating Out
  if (
    /mcdonald|burger king|\bkfc\b|subway|nando|pizza|domino|deliveroo|uber eats|just eat|greggs|costa|starbucks|caffe nero|pret|itsu|wagamama|wetherspoon|heavenly dessert|heavenly desert|restaurant|\bcafe\b|\bbar\b|bistro|takeaway/i.test(
      raw
    )
  )
    return { category: "Eating Out", exclude: false };

  // Step 9 — High Street
  if (
    /superdrug|boots|cloud city vape|cloudcityvape|maani couture|primark|tkmaxx|tk maxx|wilko|poundland|home bargains|\bb&m\b|card factory|barber|salon|hairdress|beauty|\bnail\b/i.test(
      raw
    )
  )
    return { category: "High Street", exclude: false };

  // Step 10 — Online Shopping (Amazon including truncated Amznmktplace*)
  if (
    /amazon|amznmktplace|amazon\.co\.uk|ebay|asos|very\.co|boohoo|shein|etsy|currys|ao\.com|john lewis online|app store|google play/i.test(
      raw
    )
  )
    return { category: "Online Shopping", exclude: false };

  // Step 11 — Cash & ATM
  if (
    /cash machine|cashpoint|\batm\b|cash withdrawal|link post office|cardtronics/i.test(
      raw
    )
  )
    return { category: "Cash & ATM", exclude: false };

  // Step 12 — Travel & Transport
  if (
    /\btfl\b|trainline|national rail|avanti|\bgwr\b|\blner\b|southeastern|thameslink|elizabeth line|oyster|\buber\b(?!.*eats)|bolt taxi|addison lee|\bparking\b|\bncp\b|ringo|petrol|\bbp\b|\bshell\b|\besso\b|jet2|easyjet|ryanair|british airways|\bbus\b|\bcoach\b|arriva|stagecoach/i.test(
      raw
    )
  )
    return { category: "Travel & Transport", exclude: false };

  // Step 13 — Health & Fitness
  if (
    /pharmacy|chemist|\bnhs\b|dentist|optician|specsavers|puregym|\bgym\b|fitness|holland barrett|vitamin|supplement/i.test(
      raw
    )
  )
    return { category: "Health & Fitness", exclude: false };

  // Step 14 — Household Bills
  if (
    /council tax|water board|electric|gas bill|broadband|internet|tv licence/i.test(
      raw
    )
  )
    return { category: "Household Bills", exclude: false };

  // Step 15 — Rent & Mortgage
  if (/\brent\b|landlord|letting|mortgage/i.test(raw))
    return { category: "Rent & Mortgage", exclude: false };

  // Step 16 — Finance & Bills
  if (
    /insurance|aviva|admiral|legal & general|\bloan\b|credit card|barclaycard|\bamex\b/i.test(
      raw
    )
  )
    return { category: "Finance & Bills", exclude: false };

  // Step 16b — BACS/standing order references → transfers
  if (/ref:|reference:|s\/o\s|bacs ref|faster payment|standing order/i.test(raw))
    return { category: type === "credit" ? "Transfers Received" : "Transfers Sent", exclude: false };

  // Step 17 — Remaining credits → Transfers Received
  if (type === "credit") return { category: "Transfers Received", exclude: false };

  // Step 17b — Person name pattern (2–4 capitalised words, no digits) → Transfer by type
  const cleanedForName = cleanDescription(rawDesc || "");
  if (looksLikePersonName(cleanedForName))
    return { category: type === "credit" ? "Transfers Received" : "Transfers Sent", exclude: false };

  // Step 18a — Known person names from statements
  const knownPersonTransfers = ["waleed naeem", "samra kaleem", "ali z", "kasam khalid", "kasim khalid"];
  if (knownPersonTransfers.some(n => raw.includes(n)))
    return { category: type === "credit" ? "Transfers Received" : "Transfers Sent", exclude: false };

  // Step 18b — Merchant-like debit → Online Shopping (eliminate Uncategorised for debits)
  if (type === "debit" && cleanedForName.length > 2)
    return { category: "Online Shopping", exclude: false };

  // Step 18c — Fallback for any remaining credit
  return { category: "Transfers Received", exclude: false };
}

// ---------------------------------------------------------------------------
// Reversal / refund netting engine
// ---------------------------------------------------------------------------
function applyReversals(transactions) {
  const processed = [...transactions];

  processed.forEach((tx, i) => {
    if (tx.reversalLinked) return;

    const desc        = tx.description.toLowerCase();
    const isUnpaidDD  = /unpaid direct debit|unpaid dd/i.test(tx.description);
    const isReversal  = /refund|reversal|reversed|returned|chargeback|cashback/i.test(tx.description);

    if ((isUnpaidDD || isReversal) && tx.type === "credit") {
      let matchIndex = -1;

      if (isUnpaidDD) {
        // For unpaid DDs: match by amount and try to match merchant keyword
        const keyword = desc
          .replace(/unpaid direct debit/i, "")
          .replace(/unpaid dd/i, "")
          .trim()
          .split(/\s+/)[0];
        matchIndex = processed.findIndex((other, j) =>
          j !== i &&
          other.type === "debit" &&
          Math.abs(Math.abs(other.amount) - Math.abs(tx.amount)) < 0.01 &&
          !other.reversalLinked &&
          (keyword.length < 3 || other.description.toLowerCase().includes(keyword))
        );
        // If keyword match fails, fall back to amount-only
        if (matchIndex === -1) {
          matchIndex = processed.findIndex((other, j) =>
            j !== i &&
            other.type === "debit" &&
            Math.abs(Math.abs(other.amount) - Math.abs(tx.amount)) < 0.01 &&
            !other.reversalLinked
          );
        }
      } else {
        matchIndex = processed.findIndex((other, j) =>
          j !== i &&
          other.type === "debit" &&
          Math.abs(Math.abs(other.amount) - Math.abs(tx.amount)) < 0.01 &&
          !other.reversalLinked
        );
      }

      if (matchIndex !== -1) {
        processed[i].reversalLinked             = true;
        processed[matchIndex].reversalLinked    = true;
        processed[i].excludeFromTotals          = true;
        processed[matchIndex].excludeFromTotals = true;
        processed[i].isAdjustment               = true;
        processed[matchIndex].isAdjustment      = true;
        processed[i].category    = "Refunds";
        processed[i].reversalNote = isUnpaidDD
          ? `Unpaid DD returned: ${processed[matchIndex].description}`
          : `Reversal of: ${processed[matchIndex].description}`;
      }
    }
  });

  return processed;
}

// ---------------------------------------------------------------------------
// True spending calculation
// ---------------------------------------------------------------------------
function calculateTrueSpending(transactions, endBalance, overdraftLimit) {
  const eligible = transactions.filter((tx) => !tx.exclude && !tx.excludeFromTotals);

  const trueSpending = eligible
    .filter((tx) => tx.type === "debit")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const trueIncome = eligible
    .filter((tx) => tx.type === "credit")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const categories = {};
  eligible
    .filter((tx) => tx.type === "debit")
    .forEach((tx) => {
      categories[tx.category] = (categories[tx.category] || 0) + Math.abs(tx.amount);
    });

  const liquidity = endBalance + overdraftLimit;

  return { trueSpending, trueIncome, categories, liquidity };
}

// ---------------------------------------------------------------------------
// Date normaliser  DD/MM/YYYY or YYYY-MM-DD → DD MMM YYYY
// (kept for backward compatibility)
// ---------------------------------------------------------------------------
function normaliseDate(raw) {
  if (!raw) return "";
  const s = String(raw).trim();

  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m1) {
    const d  = m1[1].padStart(2, "0");
    const mo = parseInt(m1[2], 10) - 1;
    const y  = m1[3];
    if (mo >= 0 && mo < 12) return `${d} ${MONTHS[mo]} ${y}`;
  }

  const m2 = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m2) {
    const y  = m2[1];
    const mo = parseInt(m2[2], 10) - 1;
    const d  = m2[3].padStart(2, "0");
    if (mo >= 0 && mo < 12) return `${d} ${MONTHS[mo]} ${y}`;
  }

  if (/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(s)) return s;
  return s;
}
