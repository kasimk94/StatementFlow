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

    // ── 5. Detect overdraft limit from raw text ─────────────────────────────
    const overdraftLimit = detectOverdraftLimit(rawText);
    console.log("Overdraft limit detected:", overdraftLimit);

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
        const { category, exclude } = categoriseTransaction(t.description, amount, type);
        return {
          date:              normaliseDate(t.date),
          description:       cleanDescription(t.description || "Transaction"),
          amount,
          type,
          category,
          exclude,
          excludeFromTotals: false,
          reversalLinked:    false,
          reversalNote:      null,
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
    const internalTransferTotal = transactions
      .filter(t => t.exclude && t.type === "debit")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const reversalsCount = transactions.filter(t => t.reversalLinked && t.type === "credit").length;

    // FIX 1A — Use PDF summary totals as canonical; fall back to summing transactions
    const pdfTotals = extractStatementTotals(rawText);
    const totalIncome   = pdfTotals.moneyIn  ?? transactions.filter(t => t.type === "credit" && !t.exclude).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses = pdfTotals.moneyOut ?? transactions.filter(t => t.type === "debit"  && !t.exclude).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netBalance    = totalIncome - totalExpenses;
    console.log("PDF totals:", pdfTotals, "→ income:", totalIncome, "expenses:", totalExpenses);

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
      transactionCount: transactions.length,
      confidence: "high",
      bank: "ai-parsed",
      insights,
      // Extended engine fields
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
// PART 1 — Text cleaner / pre-processor
// ---------------------------------------------------------------------------
function cleanDescription(desc) {
  return (desc || "")
    .replace(/^\)\)\)\s*/g, "")
    .replace(/^☐\s*/g, "")
    .replace(/^Card Payment to\s*/i, "")
    .replace(/^Purchase at\s*/i, "")
    .replace(/^Payment to\s*/i, "")
    .replace(/^Direct Debit to\s*/i, "")
    .replace(/^DD\s+/i, "")
    .replace(/^BGC\s+/i, "")
    .replace(/^FPI\s+/i, "")
    .replace(/^TFR\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractActualMerchant(desc) {
  const cleaned = cleanDescription(desc);
  const paypalMatch = cleaned.match(/^PayPal\s*\*?\s*(.+)/i);
  if (paypalMatch) return { merchant: paypalMatch[1].trim(), viaPaypal: true };
  return { merchant: cleaned, viaPaypal: false };
}

// ---------------------------------------------------------------------------
// FIX 1A — Statement summary total extractor
// ---------------------------------------------------------------------------
function extractStatementTotals(rawText) {
  const moneyInPatterns = [
    /total\s+money\s+in[:\s]+£?([\d,]+\.?\d*)/i,
    /money\s+in[:\s]+£?([\d,]+\.?\d*)/i,
    /total\s+credits?[:\s]+£?([\d,]+\.?\d*)/i,
    /\bcredits?\b[:\s]+£?([\d,]+\.?\d*)/i,
    /total\s+paid\s+in[:\s]+£?([\d,]+\.?\d*)/i,
    /paid\s+in[:\s]+£?([\d,]+\.?\d*)/i,
  ];
  const moneyOutPatterns = [
    /total\s+money\s+out[:\s]+£?([\d,]+\.?\d*)/i,
    /money\s+out[:\s]+£?([\d,]+\.?\d*)/i,
    /total\s+debits?[:\s]+£?([\d,]+\.?\d*)/i,
    /\bdebits?\b[:\s]+£?([\d,]+\.?\d*)/i,
    /total\s+paid\s+out[:\s]+£?([\d,]+\.?\d*)/i,
    /paid\s+out[:\s]+£?([\d,]+\.?\d*)/i,
  ];

  let moneyIn = null;
  for (const pat of moneyInPatterns) {
    const m = rawText.match(pat);
    if (m) { moneyIn = parseFloat(m[1].replace(/,/g, "")); break; }
  }

  let moneyOut = null;
  for (const pat of moneyOutPatterns) {
    const m = rawText.match(pat);
    if (m) { moneyOut = parseFloat(m[1].replace(/,/g, "")); break; }
  }

  return { moneyIn, moneyOut };
}

// ---------------------------------------------------------------------------
// FIX 1B+1C — Rebuilt categorisation engine
// ---------------------------------------------------------------------------
const CHARITY_KEYWORDS = [
  "penny appeal", "muslim global", "islamic relief", "human appeal",
  "map international", "red cross", "oxfam", "cancer research", "british heart",
  "save the children", "unicef", "shelter", "mind charity",
  "macmillan", "age uk", "rspca", "wateraid", "comic relief",
  "sport relief", "justgiving", "localgiving", "charitycheckout",
  "charity", "foundation", "appeal", "relief", "humanitarian",
];

function categoriseTransaction(description, amount, type) {
  const cleaned = cleanDescription(description || "");
  const desc    = cleaned.toLowerCase();

  // Step 1 — Refunds (first of all)
  if (/refund|reversal|reversed|cashback|money back|returned payment/i.test(desc) && type === "credit")
    return { category: "Refunds", exclude: false };

  // Step 2 — Charity (before PayPal stripping)
  if (CHARITY_KEYWORDS.some(k => desc.includes(k)))
    return { category: "Charity", exclude: false };

  // Step 3 — PayPal merchant detection
  const paypalMatch = cleaned.match(/^PayPal\s*\*?\s*(.+)/i);
  if (paypalMatch) {
    const merchant = paypalMatch[1].trim().toLowerCase();
    if (CHARITY_KEYWORDS.some(k => merchant.includes(k)))
      return { category: "Charity", exclude: false };
    if (/tesco|sainsbury|asda|morrisons|waitrose|aldi|lidl|marks & spencer food|m&s food|co-op|coop|iceland food|ocado|farmfoods|budgens|spar|whole foods/i.test(merchant))
      return { category: "Groceries", exclude: false };
    if (/mcdonald|burger king|kfc|subway|nando|pizza|domino|deliveroo|uber eats|just eat|greggs|costa coffee|starbucks|caffe nero|pret|restaurant|cafe|takeaway|dessert|ice cream/i.test(merchant))
      return { category: "Eating Out", exclude: false };
    if (/superdrug|boots|lloyds pharmacy|primark|next|tkmaxx|tk maxx|argos|wilko|poundland|card factory|salon|barber|hairdress|beauty|nail/i.test(merchant))
      return { category: "High Street", exclude: false };
    return { category: "Online Shopping", exclude: false };
  }

  // Step 4 — Transfers Received
  if (type === "credit" && /transfer|bank transfer|faster payment|fps|bacs received|standing order received|ref:|payment from/i.test(desc))
    return { category: "Transfers Received", exclude: false };

  // Step 5 — Transfers Sent
  if (type === "debit" && /transfer to|sent to|faster payment|standing order|bill payment to|\bbacs\b|kasim khalid|kasam khalid|k khalid|ref: monzo|monzo|pot transfer|\bflex\b/i.test(desc))
    return { category: "Transfers Sent", exclude: false };

  // Step 6 — Direct Debits
  if (/amazon prime|amazon membership|rci financial|rci finance|barclays partner|barclays finance|sky |virgin media|\bbt\b|talktalk|vodafone|\bee\b|\bo2\b|three mobile|council tax|tv licence|insurance|aviva|admiral|legal & general|netflix|spotify|disney|apple\.com\/bill|google storage|icloud|microsoft 365|puregym|david lloyd|thames water|ovo energy|british gas|octopus|edf/i.test(desc))
    return { category: "Direct Debits", exclude: false };

  // Step 7 — Groceries
  if (/tesco|sainsbury|asda|morrisons|waitrose|aldi|lidl|marks & spencer food|m&s food|co-op|\bcoop\b|iceland food|ocado|farmfoods|budgens|\bspar\b|whole foods|fresh and local|freshlocal|local farm|village store|corner shop|newsagent/i.test(desc))
    return { category: "Groceries", exclude: false };

  // Step 8 — Eating Out
  if (/mcdonald|burger king|\bkfc\b|subway|nando|pizza|domino|deliveroo|uber eats|just eat|greggs|costa coffee|starbucks|caffe nero|pret a manger|itsu|wagamama|wetherspoon|restaurant|\bcafe\b|\bbar\b|bistro|takeaway|heavenly desert|desserts?|ice cream|food delivery|hungry|eat\./i.test(desc))
    return { category: "Eating Out", exclude: false };

  // Step 9 — High Street
  if (/superdrug|boots pharmacy|lloyds pharmacy|cloud city vape|\bvape\b|maani couture|\bcouture\b|primark|\bnext\b|tkmaxx|tk maxx|argos|wilko|poundland|home bargains|\bb&m\b|card factory|waterstones|\bsmiths\b|\bhmv\b|barber|salon|hairdress|beauty|\bnail\b/i.test(desc))
    return { category: "High Street", exclude: false };

  // Step 10 — Online Shopping
  if (/amazon(?!.*prime)|ebay|asos|very\.co|littlewoods|boohoo|prettylittlething|shein|etsy|currys|ao\.com|john lewis online|apple store|app store|google play/i.test(desc))
    return { category: "Online Shopping", exclude: false };

  // Step 11 — Travel & Transport
  if (/\btfl\b|transport for london|trainline|national rail|avanti|\bgwr\b|\blner\b|southeastern|thameslink|elizabeth line|oyster|\buber\b(?!.*eats)|bolt taxi|addison lee|\bparking\b|\bncp\b|ringo|petrol|\bbp\b|\bshell\b|\besso\b|jet2|easyjet|ryanair|british airways|\bbus\b|\bcoach\b|arriva|stagecoach/i.test(desc))
    return { category: "Travel & Transport", exclude: false };

  // Step 12 — Health & Fitness
  if (/\bboots\b|pharmacy|chemist|\bnhs\b|dentist|optician|specsavers|puregym|\bgym\b|fitness|holland barrett|vitamin|supplement/i.test(desc))
    return { category: "Health & Fitness", exclude: false };

  // Step 13 — Household Bills
  if (/council tax|\bwater\b|electric|gas bill|broadband|internet|tv licence/i.test(desc))
    return { category: "Household Bills", exclude: false };

  // Step 14 — Cash & ATM
  if (/\batm\b|cash machine|cashpoint|withdraw|link atm/i.test(desc))
    return { category: "Cash & ATM", exclude: false };

  // Step 15 — Rent & Mortgage
  if (/\brent\b|landlord|letting|mortgage/i.test(desc))
    return { category: "Rent & Mortgage", exclude: false };

  // Step 16 — Remaining credits
  if (type === "credit") return { category: "Transfers Received", exclude: false };

  // Step 17 — Fallback
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
// PART 5 — Overdraft limit detector
// ---------------------------------------------------------------------------
function detectOverdraftLimit(rawText) {
  const patterns = [
    /arranged overdraft limit[:\s]+£?([\d,]+)/i,
    /overdraft limit[:\s]+£?([\d,]+)/i,
    /your arranged limit[:\s]+£?([\d,]+)/i,
    /available overdraft[:\s]+£?([\d,]+)/i,
    /arranged limit[:\s]+£?([\d,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match) return parseFloat(match[1].replace(/,/g, ""));
  }
  return 500; // Default assumption
}

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
