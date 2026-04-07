import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/convert
// ---------------------------------------------------------------------------
export async function POST(req) {
  try {
    console.log("=== PDF CONVERSION STARTED ===");

    // ── 1. Read form data ───────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") || formData.get("pdf");

    if (!file) {
      console.error("No file in request");
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

    // ── 3. Extract text from PDF ────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    let rawText = "";
    try {
      const unpdf = await import("unpdf");
      const result = await unpdf.extractText(uint8, { mergePages: true });
      rawText = Array.isArray(result.text)
        ? result.text.join("\n")
        : result.text || "";
      console.log("Text extracted, length:", rawText.length);
    } catch (pdfErr) {
      console.error("PDF extraction failed:", pdfErr.message);
      return NextResponse.json(
        { error: "Could not read this PDF file. Please make sure it is a valid bank statement." },
        { status: 400 }
      );
    }

    if (!rawText || rawText.trim().length < 50) {
      console.error("Extracted text too short:", rawText?.length);
      return NextResponse.json(
        { error: "This PDF appears to be a scanned image. Please use a text-based PDF bank statement." },
        { status: 400 }
      );
    }

    // ── 4. Check API key ────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not set!");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }
    console.log("API key present:", apiKey.substring(0, 10) + "...");

    // ── 5. Extract statement summary totals from PDF text ──────────────────
    const pdfSummary = extractStatementTotals(rawText);
    const overdraftLimit = pdfSummary.overdraftLimit ?? 500;
    console.log("PDF summary extracted:", pdfSummary);

    // Truncate very large statements before sending to AI
    const textForParsing = rawText.length > 50000 ? rawText.substring(0, 50000) : rawText;

    // ── 6. Parse with Claude (text extraction only — no categorisation) ─────
    let parsed = [];
    try {
      parsed = await parseWithClaude(textForParsing, apiKey);
      console.log("Transactions parsed:", parsed.length);
    } catch (claudeErr) {
      console.error("Claude parsing failed:", claudeErr.message);
      return NextResponse.json(
        { error: "AI parsing failed: " + claudeErr.message },
        { status: 500 }
      );
    }

    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        { error: "No transactions found in this statement. Please check the file is a valid bank statement." },
        { status: 400 }
      );
    }

    // ── 7. Normalise + apply regex categorisation engine ───────────────────
    const rawTransactions = parsed
      .map((t) => {
        const amount =
          typeof t.amount === "number"
            ? t.amount
            : parseFloat(String(t.amount).replace(/[^0-9.\-]/g, "")) || 0;
        const type = t.type || (amount >= 0 ? "credit" : "debit");
        const { category, exclude, isInternal = false, note = null } = categoriseTransaction(t.description, amount, type);
        return {
          date:              normaliseDate(t.date),
          description:       cleanDescription(t.description || "Transaction"),
          amount,
          type,
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
        { error: "Could not normalise any transactions from the parsed data. Please try again." },
        { status: 400 }
      );
    }

    // ── 8. Apply reversal / refund netting engine ───────────────────────────
    const transactions = applyReversals(rawTransactions);

    // ── 9. Calculate totals ─────────────────────────────────────────────────
    // FIX 4 — Internal transfer total from isInternal flag
    const internalTransferTotal = transactions
      .filter(t => t.isInternal && t.type === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const reversalsCount = transactions.filter(t => t.reversalLinked && t.type === "credit").length;

    // FIX 1 — Always use PDF summary totals as canonical; fall back to summing
    const totalIncome   = pdfSummary.moneyIn  ?? transactions.filter(t => t.type === "credit" && !t.exclude).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses = pdfSummary.moneyOut ?? transactions.filter(t => t.type === "debit"  && !t.exclude).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netBalance    = (pdfSummary.endBalance !== null && pdfSummary.endBalance !== undefined)
      ? pdfSummary.endBalance
      : totalIncome - totalExpenses;
    console.log("Totals → income:", totalIncome, "expenses:", totalExpenses, "net:", netBalance);

    const { trueSpending, trueIncome, categories, liquidity } =
      calculateTrueSpending(transactions, netBalance, overdraftLimit);

    // ── 10. Generate AI insights (score + tips — no categorisation) ─────────
    let insights = null;
    try {
      insights = await generateInsights(transactions, apiKey);
      console.log("Insights generated:", !!insights);
    } catch (insightErr) {
      console.error("Insights generation failed (non-fatal):", insightErr.message);
    }

    console.log("=== CONVERSION SUCCESS ===", transactions.length, "transactions");

    return NextResponse.json({
      transactions,
      totalIncome,
      totalExpenses,
      netBalance,
      startBalance: pdfSummary.startBalance,
      endBalance:   pdfSummary.endBalance,
      transactionCount: transactions.length,
      confidence: "high",
      bank: "ai-parsed",
      insights,
      trueSpending,
      trueIncome,
      overdraftLimit,
      liquidity,
      internalTransferTotal,
      reversalsCount,
      categoryBreakdown: categories,
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
// FIX 2 — Text cleaner (handles Barclays truncated merchant names)
// ---------------------------------------------------------------------------
function cleanDescription(desc) {
  return (desc || "")
    .replace(/^Card Payment to\s*/i, "")
    .replace(/^Bill Payment to\s*/i, "")
    .replace(/^Direct Debit to\s*/i, "")
    .replace(/^Cash Machine Withdrawal at\s*/i, "")
    .replace(/^Cash Withdrawal at\s*/i, "")
    .replace(/^Received From\s*/i, "")
    .replace(/^Refund From\s*/i, "")
    .replace(/\s+On \d{1,2} \w+$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// FIX 1 — Statement summary extractor (exact Barclays PDF patterns)
// ---------------------------------------------------------------------------
function extractStatementTotals(rawText) {
  const moneyInMatch    = rawText.match(/Money in\s+£?([\d,]+\.?\d*)/i);
  const moneyOutMatch   = rawText.match(/Money out\s+£?([\d,]+\.?\d*)/i);
  const startBalMatch   = rawText.match(/Start balance\s+-?£?([\d,]+\.?\d*)/i);
  const endBalMatch     = rawText.match(/End balance\s+-?£?([\d,]+\.?\d*)/i);
  const overdraftMatch  = rawText.match(/(?:Arranged )?[Oo]verdraft(?:\s+limit)?\s+£?([\d,]+\.?\d*)/i);

  const parseAmt = (match, raw, label) => {
    if (!match) return null;
    const sign = raw.includes(`${label} -`) ? -1 : 1;
    return sign * parseFloat(match[1].replace(/,/g, ""));
  };

  // Fallback patterns for other banks
  const fallbackIn = moneyInMatch ? null :
    (rawText.match(/total\s+money\s+in[:\s]+£?([\d,]+\.?\d*)/i) ||
     rawText.match(/total\s+credits?[:\s]+£?([\d,]+\.?\d*)/i) ||
     rawText.match(/paid\s+in[:\s]+£?([\d,]+\.?\d*)/i));
  const fallbackOut = moneyOutMatch ? null :
    (rawText.match(/total\s+money\s+out[:\s]+£?([\d,]+\.?\d*)/i) ||
     rawText.match(/total\s+debits?[:\s]+£?([\d,]+\.?\d*)/i) ||
     rawText.match(/paid\s+out[:\s]+£?([\d,]+\.?\d*)/i));

  return {
    moneyIn:       moneyInMatch  ? parseFloat(moneyInMatch[1].replace(/,/g, ""))    : (fallbackIn  ? parseFloat(fallbackIn[1].replace(/,/g, ""))  : null),
    moneyOut:      moneyOutMatch ? parseFloat(moneyOutMatch[1].replace(/,/g, ""))   : (fallbackOut ? parseFloat(fallbackOut[1].replace(/,/g, "")) : null),
    startBalance:  parseAmt(startBalMatch,  rawText, "Start balance"),
    endBalance:    parseAmt(endBalMatch,    rawText, "End balance"),
    overdraftLimit: overdraftMatch ? parseFloat(overdraftMatch[1].replace(/,/g, "")) : null,
  };
}

// ---------------------------------------------------------------------------
// FIX 3+4+5 — Rebuilt categorisation engine (exact Barclays patterns)
// ---------------------------------------------------------------------------
function categoriseTransaction(rawDesc, amount, type) {
  const raw     = (rawDesc || "").toLowerCase();
  const cleaned = cleanDescription(rawDesc || "");

  // Step 1 — Refunds / Unpaid DDs (credits with refund keywords)
  // FIX 5: Unpaid Direct Debits appear as credits — treat as Refunds
  if (type === "credit" && /refund|reversal|reversed|unpaid|money back|returned/i.test(raw)) {
    const note = /unpaid/i.test(raw) ? "Unpaid DD returned" : null;
    return { category: "Refunds", exclude: false, note };
  }

  // Step 2 — Internal transfers (FIX 4: flag with isInternal)
  if (/kasam khalid|kasim khalid|k khalid|ref:\s*monzo/i.test(raw))
    return { category: "Transfers Sent", exclude: false, isInternal: true };

  // Step 3 — Transfers Received (specific known payees)
  if (type === "credit" && /received from|ali z\b|hmrc|child benefit|samra kaleem/i.test(raw))
    return { category: "Transfers Received", exclude: false };

  // Step 4 — Charity (BEFORE PayPal resolution — catches truncated names)
  if (/penny\s*appea|pennyappea|human\s*appea|humanappea|muslim\s*glob|muslimglob|islamic\s*relief|islamicrelief|islamic relief wor|islamic relief can|map\.org|www\.map|penny appeal|human appeal|muslim global|red cross|oxfam|cancer research|british heart|save the children|unicef|shelter|macmillan|wateraid|comic relief|justgiving|localgiving|charitycheckout/i.test(raw))
    return { category: "Charity", exclude: false };

  // Step 5 — PayPal merchant detection (after charity check)
  const paypalMatch = cleaned.match(/paypal\s*\*?(\w+)/i);
  if (paypalMatch) {
    const merchant = paypalMatch[1].toLowerCase();
    if (/pennyappea|humanappea|muslimglob|islamicrel|appeal|relief|charity|found/i.test(merchant))
      return { category: "Charity", exclude: false };
    if (/argos|argosdirec/i.test(merchant))  return { category: "Online Shopping", exclude: false };
    if (/asda|tesco|sainsbury|morrisons/i.test(merchant)) return { category: "Groceries", exclude: false };
    if (/ebay/i.test(merchant))              return { category: "Online Shopping", exclude: false };
    return { category: "Online Shopping", exclude: false };
  }

  // Step 6 — Direct Debits (recurring / known DD merchants)
  if (/rci financial serv|rci financial|rcifinancial|barclays prtnr fin|barclays partner|barclaysprtnr|amazon prime|amazon.*prime|sky |virgin media|\bbt\b|talktalk|vodafone|\bee\b|\bo2\b|three mobile|council tax|tv licence|netflix|spotify|disney|apple\.com|google storage|icloud|microsoft 365|puregym|david lloyd|ovo energy|british gas|octopus|edf/i.test(raw))
    return { category: "Direct Debits", exclude: false };

  // Step 7 — Groceries
  if (/tesco|sainsbury|asda|morrisons|waitrose|aldi|lidl|marks & spencer food|m&s food|co-op|coop|iceland|ocado|farmfoods|budgens|\bspar\b|whole foods|fresh and local|freshlocal|local farm/i.test(raw))
    return { category: "Groceries", exclude: false };

  // Step 8 — Eating Out
  if (/mcdonald|burger king|\bkfc\b|subway|nando|pizza|domino|deliveroo|uber eats|just eat|greggs|costa|starbucks|caffe nero|pret|itsu|wagamama|wetherspoon|heavenly dessert|heavenly desert|restaurant|\bcafe\b|\bbar\b|bistro|takeaway/i.test(raw))
    return { category: "Eating Out", exclude: false };

  // Step 9 — High Street
  if (/superdrug|boots|cloud city vape|cloudcityvape|maani couture|primark|tkmaxx|tk maxx|wilko|poundland|home bargains|\bb&m\b|card factory|barber|salon|hairdress|beauty|\bnail\b/i.test(raw))
    return { category: "High Street", exclude: false };

  // Step 10 — Online Shopping (Amazon including truncated Amznmktplace*XXXXX)
  if (/amazon|amznmktplace|amazon\.co\.uk|ebay|asos|very\.co|boohoo|shein|etsy|currys|ao\.com|john lewis online|app store|google play/i.test(raw))
    return { category: "Online Shopping", exclude: false };

  // Step 11 — Cash & ATM
  if (/cash machine|cashpoint|\batm\b|cash withdrawal|link post office|cardtronics/i.test(raw))
    return { category: "Cash & ATM", exclude: false };

  // Step 12 — Travel & Transport
  if (/\btfl\b|trainline|national rail|avanti|\bgwr\b|\blner\b|southeastern|thameslink|elizabeth line|oyster|\buber\b(?!.*eats)|bolt taxi|addison lee|\bparking\b|\bncp\b|ringo|petrol|\bbp\b|\bshell\b|\besso\b|jet2|easyjet|ryanair|british airways|\bbus\b|\bcoach\b|arriva|stagecoach/i.test(raw))
    return { category: "Travel & Transport", exclude: false };

  // Step 13 — Health & Fitness
  if (/pharmacy|chemist|\bnhs\b|dentist|optician|specsavers|puregym|\bgym\b|fitness|holland barrett|vitamin|supplement/i.test(raw))
    return { category: "Health & Fitness", exclude: false };

  // Step 14 — Household Bills
  if (/council tax|water board|electric|gas bill|broadband|internet|tv licence/i.test(raw))
    return { category: "Household Bills", exclude: false };

  // Step 15 — Rent & Mortgage
  if (/\brent\b|landlord|letting|mortgage/i.test(raw))
    return { category: "Rent & Mortgage", exclude: false };

  // Step 16 — Finance & Bills
  if (/insurance|aviva|admiral|legal & general|\bloan\b|credit card|barclaycard|\bamex\b/i.test(raw))
    return { category: "Finance & Bills", exclude: false };

  // Step 17 — Remaining credits → Transfers Received
  if (type === "credit") return { category: "Transfers Received", exclude: false };

  // Step 18 — Fallback
  return { category: "Uncategorised", exclude: false };
}

// ---------------------------------------------------------------------------
// PART 4 — Reversal / refund netting engine
// ---------------------------------------------------------------------------
function applyReversals(transactions) {
  const processed = [...transactions];

  processed.forEach((tx, i) => {
    if (tx.reversalLinked) return;
    const isReversal = /refund|reversal|reversed|unpaid|returned|chargeback|cashback/i.test(tx.description);

    if (isReversal && tx.type === "credit") {
      const matchIndex = processed.findIndex((other, j) =>
        j !== i &&
        other.type === "debit" &&
        Math.abs(Math.abs(other.amount) - Math.abs(tx.amount)) < 0.01 &&
        !other.reversalLinked
      );

      if (matchIndex !== -1) {
        processed[i].reversalLinked          = true;
        processed[matchIndex].reversalLinked = true;
        processed[i].excludeFromTotals          = true;
        processed[matchIndex].excludeFromTotals = true;
        processed[i].reversalNote = `Reversal of: ${processed[matchIndex].description}`;
      }
    }
  });

  return processed;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PART 6 — True spending calculation
// ---------------------------------------------------------------------------
function calculateTrueSpending(transactions, endBalance, overdraftLimit) {
  const eligible = transactions.filter(tx => !tx.exclude && !tx.excludeFromTotals);

  const trueSpending = eligible
    .filter(tx => tx.type === "debit")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const trueIncome = eligible
    .filter(tx => tx.type === "credit")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const categories = {};
  eligible.filter(tx => tx.type === "debit").forEach(tx => {
    categories[tx.category] = (categories[tx.category] || 0) + Math.abs(tx.amount);
  });

  const liquidity = endBalance + overdraftLimit;

  return { trueSpending, trueIncome, categories, liquidity };
}

// ---------------------------------------------------------------------------
// Subscription detector (used by insights generator)
// ---------------------------------------------------------------------------
function detectSubscriptions(transactions) {
  const knownSubs = [
    "netflix","spotify","disney","apple music","apple tv",
    "amazon prime","prime video","now tv","nowtv","sky cinema","sky sports",
    "microsoft 365","microsoft office","adobe","creative cloud",
    "youtube premium","google one","icloud",
    "playstation plus","ps plus","xbox game pass","nintendo online",
    "audible","kindle unlimited",
    "puregym","pure gym","david lloyd","virgin active","anytime fitness",
    "duolingo","headspace","calm",
    "dropbox","onedrive",
    "deliveroo plus","uber one",
    "insurance","aviva","axa","direct line","admiral",
    "vodafone","o2","ee","three","bt","sky broadband","virgin media","talktalk",
    "council tax","tv licence",
  ];
  const neverSubs = [
    "tesco","sainsbury","asda","morrisons","waitrose","lidl","aldi","co-op","iceland","farmfoods","ocado",
    "amazon marketplace","amzn","ebay","argos","currys","primark","asos",
    "mcdonald","kfc","subway","greggs","costa","starbucks","deliveroo","just eat","uber",
    "tfl","trainline","petrol","bp","shell","esso","boots","pharmacy","atm","cash","paypal","transfer",
  ];

  function looksLikePersonName(name) {
    const words = name.trim().split(/\s+/);
    return words.length >= 2 && words.length <= 3 && words.every(w => /^[A-Z][a-z]+$/.test(w));
  }

  const subscriptions = [];
  const eligibleDebits = transactions.filter(t => t.type === "debit" && !t.exclude && !t.excludeFromTotals);

  eligibleDebits.forEach(t => {
    const desc = t.description.toLowerCase();
    const isKnown  = knownSubs.some(s => desc.includes(s));
    const isNever  = neverSubs.some(s => desc.includes(s));
    if (looksLikePersonName(t.description)) return;
    if (["financial services","rci","loan","mortgage","rent","landlord","letting"].some(s => desc.includes(s))) return;
    if (/\bamazon\b/.test(desc) && !desc.includes("amazon prime") && !desc.includes("prime video")) return;

    if (isKnown && !isNever) {
      const existing = subscriptions.find(s => s.name === t.description);
      if (existing) { existing.total += Math.abs(t.amount); existing.count++; }
      else subscriptions.push({ name: t.description, amount: Math.abs(t.amount), total: Math.abs(t.amount), count: 1 });
      return;
    }
    if (!isNever && !isKnown) {
      const same = eligibleDebits.filter(t2 => t2.description === t.description && Math.abs(Math.abs(t2.amount) - Math.abs(t.amount)) < 0.01);
      if (same.length >= 2 && !subscriptions.find(s => s.name === t.description))
        subscriptions.push({ name: t.description, amount: Math.abs(t.amount), total: Math.abs(t.amount) * same.length, count: same.length, detected: "pattern" });
    }
  });

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  return { list: subscriptions, total, count: subscriptions.length };
}

// ---------------------------------------------------------------------------
// AI Insights generator (score + tips only — NOT categorisation)
// ---------------------------------------------------------------------------
async function generateInsights(transactions, apiKey) {
  const eligible = transactions.filter(t => !t.exclude && !t.excludeFromTotals);
  const totalIncome   = eligible.filter(t => t.type === "credit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpenses = eligible.filter(t => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categories = {};
  eligible.filter(t => t.type === "debit").forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount);
  });

  const detected = detectSubscriptions(transactions);

  const merchantTotals = {};
  eligible.filter(t => t.type === "debit").forEach(t => {
    merchantTotals[t.description] = (merchantTotals[t.description] || 0) + Math.abs(t.amount);
  });
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  const summaryData = {
    totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses,
    transactionCount: eligible.length, categories,
    subscriptions: { total: detected.total, list: detected.list.map(s => `${s.name} £${s.amount.toFixed(2)}`), count: detected.count },
    topMerchants,
    dateRange: { first: transactions[transactions.length - 1]?.date, last: transactions[0]?.date },
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a friendly UK personal finance assistant. Analyse this spending summary and return a JSON object with insights.

IMPORTANT: Categorisation has already been done accurately by our rule engine. Use the provided data as-is — do NOT reclassify any spending. Focus on observations, tips, and the spending score only.

Spending data: ${JSON.stringify(summaryData)}

Return ONLY this JSON structure with NO markdown:
{
  "summary": "One sentence overview of their finances this month",
  "topInsight": "The single most important observation about their spending",
  "subscriptions": {
    "total": 0.00,
    "list": ["Netflix £10.99", "Spotify £9.99"],
    "message": "You spend £X/month on subscriptions"
  },
  "biggestCategory": {
    "name": "category name",
    "amount": 0.00,
    "percentage": 0,
    "message": "friendly observation about this"
  },
  "savingsOpportunity": {
    "message": "One specific actionable saving tip based on their spending",
    "potentialSaving": "£X per month"
  },
  "unusualSpending": {
    "detected": true,
    "message": "observation if something looks unusual or high"
  },
  "positiveNote": "One encouraging positive observation about their finances",
  "spendingScore": 75,
  "spendingScoreLabel": "Good",
  "alerts": ["alert 1 if any"]
}

Be friendly, specific with £ amounts, and genuinely helpful. Use British English.`,
      }],
    }),
  });

  const data = await response.json();
  if (data.error) return null;
  const text  = data.content?.[0]?.text?.trim() ?? "";
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  return JSON.parse(text.substring(start, end + 1));
}

// ---------------------------------------------------------------------------
// Claude AI parser — PDF text → raw transaction list (no categorisation)
// ---------------------------------------------------------------------------
function extractTransactionLines(rawText) {
  const lines = rawText.split("\n");
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (t.length < 3) return false;
    const hasAmount  = /[£$]?\d+[.,]\d{2}/.test(t);
    const hasDate    = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]?\d{0,4}|\d{1,2}\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(t);
    const hasKeyword = /(debit|credit|payment|transfer|balance|paid|received|purchase|withdrawal|deposit)/i.test(t);
    return hasAmount || hasDate || hasKeyword;
  });
  return filtered.join("\n").substring(0, 8000);
}

function extractJSON(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start   = cleaned.indexOf("[");
  if (start === -1) throw new Error("No JSON array found: " + cleaned.substring(0, 100));

  const end = cleaned.lastIndexOf("]");
  if (end !== -1 && end > start) {
    try { return JSON.parse(cleaned.substring(start, end + 1)); } catch (_) { console.log("Full parse failed, repairing..."); }
  }

  const jsonStr   = cleaned.substring(start);
  const lastComma = jsonStr.lastIndexOf("},");
  if (lastComma !== -1) {
    try { return JSON.parse(jsonStr.substring(0, lastComma + 1) + "]"); } catch (e) { console.log("Repair failed:", e.message); }
  }

  const lastBrace = jsonStr.lastIndexOf("}");
  if (lastBrace !== -1) {
    try { return JSON.parse(jsonStr.substring(0, lastBrace + 1) + "]"); } catch (e) { throw new Error("Could not parse JSON: " + e.message); }
  }

  throw new Error("No valid JSON found");
}

async function parseWithClaude(rawText, apiKey) {
  const processedText = extractTransactionLines(rawText);
  console.log("Sending to Claude, text length:", processedText.length);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `CRITICAL: Return complete valid JSON only. No markdown. No explanation. Start with [ end with ]

You are an expert UK bank statement parser. Extract ALL transactions accurately.

RULES:
1. Debits (money OUT) = NEGATIVE amount + type "debit"
2. Credits (money IN) = POSITIVE amount + type "credit"
3. Keep merchant names exactly as they appear in the statement — do NOT clean or modify them
4. Date format: DD/MM/YYYY always
5. NEVER skip a transaction

Return ONLY valid JSON array:
[{"date":"DD/MM/YYYY","description":"Original Description","amount":-45.50,"type":"debit","balance":null}]

Statement data:
${processedText}`,
      }],
    }),
  });

  console.log("Claude response status:", response.status);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log("Claude response:", JSON.stringify(data).substring(0, 200));
  if (data.error) throw new Error(`Claude API: ${data.error.type} - ${data.error.message}`);

  const text = data.content?.[0]?.text?.trim() ?? "";
  console.log("Claude text response:", text.substring(0, 300));
  return extractJSON(text);
}

// ---------------------------------------------------------------------------
// Date normaliser  DD/MM/YYYY → DD MMM YYYY
// ---------------------------------------------------------------------------
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
