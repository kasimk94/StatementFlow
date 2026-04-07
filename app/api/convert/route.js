import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/convert  — free local extraction, zero API cost
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    console.log("=== PDF CONVERSION STARTED ===");

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

    // ── 3. Extract text via pdf-parse (free, local, zero cost) ─────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractTextFromPDF(buffer);

    if (!extraction.text || extraction.text.trim().length < 20) {
      return NextResponse.json(
        {
          error:
            "scanned-pdf: Could not read this PDF. It may be a scanned document. " +
            "Please try a PDF downloaded directly from your bank's app or website as a digital PDF.",
        },
        { status: 400 }
      );
    }

    const rawText = extraction.text;
    console.log("Text extracted, length:", rawText.length, "method:", extraction.method);

    // ── 4. Extract PDF summary totals (e.g. Barclays Money in/out) ─────────
    const pdfSummary = extractStatementTotals(rawText);
    const overdraftLimit = pdfSummary.overdraftLimit ?? 500;
    console.log("PDF summary:", pdfSummary);

    // ── 5. Detect bank ──────────────────────────────────────────────────────
    const bankName = detectBank(rawText);
    console.log("Bank detected:", bankName);

    // ── 6. Parse transactions with local regex engine ───────────────────────
    const parsed = parseTransactions(rawText, bankName);
    console.log("Transactions parsed:", parsed.length);

    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transactions found in this statement. Please check the file is a valid bank statement.",
        },
        { status: 400 }
      );
    }

    // ── 7. Categorise + normalise ───────────────────────────────────────────
    const rawTransactions = parsed
      .map((t) => {
        const { category, exclude, isInternal = false, note = null } =
          categoriseTransaction(t.description, t.amount, t.type);
        return {
          date:              t.date,
          description:       cleanDescription(t.description || "Transaction"),
          amount:            t.amount,
          type:              t.type,
          category,
          exclude,
          isInternal,
          excludeFromTotals: false,
          reversalLinked:    false,
          reversalNote:      note,
        };
      })
      .filter((t) => t.date && !isNaN(t.amount));

    if (rawTransactions.length === 0) {
      return NextResponse.json(
        { error: "Could not normalise any transactions. Please try again." },
        { status: 400 }
      );
    }

    // ── 8. Apply reversal / refund netting ─────────────────────────────────
    const transactions = applyReversals(rawTransactions);

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

    const period = extractPeriod(rawText);

    console.log("=== CONVERSION SUCCESS ===", transactions.length, "transactions");

    return NextResponse.json({
      transactions,
      totalIncome,
      totalExpenses,
      netBalance,
      startBalance:         pdfSummary.startBalance,
      endBalance:           pdfSummary.endBalance,
      transactionCount:     transactions.length,
      confidence:           "high",
      bank:                 bankName,
      insights:             null,
      trueSpending,
      trueIncome,
      overdraftLimit,
      liquidity,
      internalTransferTotal,
      reversalsCount,
      categoryBreakdown:    categories,
      period,
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
// PDF text extraction — pdf-parse (free, local, zero API cost)
// ---------------------------------------------------------------------------
async function extractTextFromPDF(buffer) {
  return new Promise((resolve) => {
    try {
      // pdf2json — pure Node.js, no browser APIs, works in Vercel serverless
      const PDF2Json = require("pdf2json");
      const pdfParser = new PDF2Json(null, 1);

      console.log("PDF buffer size:", buffer.length);

      pdfParser.on("pdfParser_dataError", (err) => {
        console.error("pdf2json error:", err.parserError);
        resolve({ text: null, method: "failed", cost: 0, error: err.parserError });
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        try {
          let fullText = "";

          if (pdfData && pdfData.Pages) {
            pdfData.Pages.forEach((page) => {
              if (page.Texts) {
                page.Texts.forEach((textItem) => {
                  if (textItem.R) {
                    textItem.R.forEach((r) => {
                      if (r.T) {
                        fullText += decodeURIComponent(r.T) + " ";
                      }
                    });
                  }
                });
              }
              fullText += "\n";
            });
          }

          console.log("pdf2json extracted length:", fullText.length);
          console.log("First 300 chars:", fullText.substring(0, 300));

          if (fullText.trim().length > 50) {
            resolve({ text: fullText, method: "pdf2json", cost: 0 });
          } else {
            resolve({
              text: null,
              method: "failed",
              cost: 0,
              error: "No text extracted — PDF may be scanned",
            });
          }
        } catch (parseErr) {
          console.error("pdf2json parse error:", parseErr.message);
          resolve({ text: null, method: "failed", cost: 0, error: parseErr.message });
        }
      });

      pdfParser.parseBuffer(buffer);
    } catch (err) {
      console.error("pdf2json init error:", err.message);
      resolve({ text: null, method: "failed", cost: 0, error: err.message });
    }
  });
}

// ---------------------------------------------------------------------------
// Bank detection from raw extracted text
// ---------------------------------------------------------------------------
function detectBank(text) {
  const t = text.toLowerCase();
  if (t.includes("barclays"))                                    return "Barclays";
  if (t.includes("monzo"))                                       return "Monzo";
  if (t.includes("starling"))                                    return "Starling Bank";
  if (t.includes("hsbc"))                                        return "HSBC";
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
// FIX 3+4+5 — Rebuilt categorisation engine (18-step, first-match-wins)
// ---------------------------------------------------------------------------
function categoriseTransaction(rawDesc, amount, type) {
  const raw     = (rawDesc || "").toLowerCase();
  const cleaned = cleanDescription(rawDesc || "");

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
    return { category: "Transfers Sent", exclude: false, isInternal: true };

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

  // Step 17 — Remaining credits → Transfers Received
  if (type === "credit") return { category: "Transfers Received", exclude: false };

  // Step 18 — Fallback
  return { category: "Uncategorised", exclude: false };
}

// ---------------------------------------------------------------------------
// Reversal / refund netting engine
// ---------------------------------------------------------------------------
function applyReversals(transactions) {
  const processed = [...transactions];

  processed.forEach((tx, i) => {
    if (tx.reversalLinked) return;
    const isReversal =
      /refund|reversal|reversed|unpaid|returned|chargeback|cashback/i.test(
        tx.description
      );

    if (isReversal && tx.type === "credit") {
      const matchIndex = processed.findIndex(
        (other, j) =>
          j !== i &&
          other.type === "debit" &&
          Math.abs(Math.abs(other.amount) - Math.abs(tx.amount)) < 0.01 &&
          !other.reversalLinked
      );

      if (matchIndex !== -1) {
        processed[i].reversalLinked             = true;
        processed[matchIndex].reversalLinked    = true;
        processed[i].excludeFromTotals          = true;
        processed[matchIndex].excludeFromTotals = true;
        processed[i].reversalNote = `Reversal of: ${processed[matchIndex].description}`;
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
