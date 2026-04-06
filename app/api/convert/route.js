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

    const totalIncome   = transactions.filter(t => t.type === "credit" && !t.exclude).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses = transactions.filter(t => t.type === "debit"  && !t.exclude).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netBalance    = totalIncome - totalExpenses;

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
// PART 2 — Internal transfer detection
// ---------------------------------------------------------------------------
function isInternalTransfer(desc) {
  const d = desc.toLowerCase();
  const patterns = [
    "kasim khalid", "kasam khalid", "k khalid",
    "ref: monzo", "monzo",
    "savings pot", "save the change",
    "transfer to", "transfer from",
    "own transfer", "between accounts",
    "self transfer", "pot transfer",
    "flex saver",
  ];
  return patterns.some(p => d.includes(p));
}

// ---------------------------------------------------------------------------
// PART 3 — Regex categorisation engine (first match wins)
// ---------------------------------------------------------------------------
function categoriseTransaction(description, amount, type) {
  const desc = cleanDescription(description || "").toLowerCase();

  // Internal transfers — excluded from spending totals
  if (isInternalTransfer(desc)) return { category: "Bank Transfers", exclude: true };

  // ── Credits ────────────────────────────────────────────────────────────────
  if (type === "credit" || amount > 0) {
    if (/salary|payroll|wages|bacs credit|employer|hmrc|tax credit|universal credit|dwp|state pension|dividend|interest paid/i.test(desc))
      return { category: "Income & Salary", exclude: false };
    if (/refund|reversal|reversed|cashback|chargeback/i.test(desc))
      return { category: "Refunds", exclude: false };
    return { category: "Bank Transfers", exclude: false };
  }

  // ── Cash & ATM ─────────────────────────────────────────────────────────────
  if (/\batm\b|cash machine|cashpoint|cash withdrawal|link atm/i.test(desc))
    return { category: "Cash & ATM", exclude: false };

  // ── Supermarkets & Food ────────────────────────────────────────────────────
  if (/tesco|sainsbury|sainsburys|asda|morrisons|waitrose|aldi|lidl|marks\s*&\s*spencer|m&s food|co-op|coop|iceland\b|ocado|farmfoods|budgens|\bspar\b|booths|whole foods|costco/i.test(desc))
    return { category: "Supermarkets & Food", exclude: false };

  // ── Eating & Drinking ──────────────────────────────────────────────────────
  if (/mcdonald|burger king|\bkfc\b|subway|nando|pizza hut|domino|deliveroo|uber eats|just eat|greggs|costa coffee|starbucks|caffe nero|pret a manger|pret\b|itsu|wagamama|wetherspoon|restaurant|bistro|takeaway|leon\b|wasabi|five guys|franco manca|honest burger|bill's|carluccio|zizzi|pizza express|nando/i.test(desc))
    return { category: "Eating & Drinking", exclude: false };

  // ── Travel & Transport ─────────────────────────────────────────────────────
  if (/\btfl\b|transport for london|trainline|national rail|avanti west|great western|gwr\b|lner\b|southeastern|southern rail|thameslink|crossrail|elizabeth line|oyster card|\bbolt\b|addison lee|\bparking\b|ncp\b|ringo\b|just park|petrol|bp\b|shell\b|esso\b|texaco|jet2|easyjet|ryanair|british airways|luton airport|gatwick|heathrow|stansted|eurostar|\bbus\b|national express|coach\b|arriva|stagecoach|first group|go ahead/i.test(desc))
    return { category: "Travel & Transport", exclude: false };

  // Uber — transport only (not Uber Eats)
  if (/\buber\b/i.test(desc) && !/uber\s*eats/i.test(desc))
    return { category: "Travel & Transport", exclude: false };

  // ── Subscriptions & Streaming — before shopping so Amazon Prime beats Amazon
  if (/netflix|spotify|amazon prime|prime video|disney\+|disney plus|apple tv\+?|now tv|now ent|sky cinema|sky sports|sky q|paramount\+?|britbox|apple music|youtube premium|google one|icloud\+?|adobe cc|creative cloud|microsoft 365|office 365|xbox game pass|playstation plus|ps plus|\bpsn\b|nintendo online|headspace|calm\b|duolingo|audible|kindle unlimited|medium\.com|substack/i.test(desc))
    return { category: "Subscriptions & Streaming", exclude: false };

  // ── Online & High Street Shopping ──────────────────────────────────────────
  if (/amazon|amznmktplace|\bamzn\b|ebay|asos|\bnext\b|primark|zara|h&m|topshop|argos|currys|pc world|john lewis|harvey nichols|selfridges|tkmaxx|tk maxx|sports direct|jd sports|nike|adidas|apple store|paypal|shein|very\.co|boohoo|pretty little thing|ao\.com|wayfair|ikea|b&q|screwfix|wickes/i.test(desc))
    return { category: "Online & High Street", exclude: false };

  // ── Household Bills ────────────────────────────────────────────────────────
  if (/british gas|ovo energy|octopus energy|edf energy|e\.on|npower|bulb|thames water|severn trent|anglian water|\bbt\b|virgin media|sky broadband|talktalk|vodafone|\bee\b|\bo2\b|\bthree\b|council tax|tv licence|broadband/i.test(desc))
    return { category: "Household Bills", exclude: false };

  // ── Health & Fitness ───────────────────────────────────────────────────────
  if (/boots\b|lloyds pharmacy|superdrug|chemist|pharmacy|nhs\b|dentist|optician|specsavers|vision express|puregym|pure gym|\bgym\b|anytime fitness|david lloyd|nuffield health|bupa|axa health|holland barrett/i.test(desc))
    return { category: "Health & Fitness", exclude: false };

  // ── Entertainment & Leisure ────────────────────────────────────────────────
  if (/cinema|odeon|vue\b|cineworld|picturehouse|theatre|museum|gallery|english heritage|national trust|bowling|laser quest|escape room|go ape|legoland|alton towers|thorpe park|\bzoo\b|aquarium|concert|ticketmaster|see tickets|eventbrite|airbnb|travelodge|premier inn|holiday inn|booking\.com|expedia|hotels\.com/i.test(desc))
    return { category: "Entertainment & Leisure", exclude: false };

  // ── Rent & Mortgage ────────────────────────────────────────────────────────
  if (/\brent\b|landlord|letting|estate agent|rightmove|zoopla|foxton|connells|purple bricks/i.test(desc))
    return { category: "Rent & Mortgage", exclude: false };

  // ── Finance & Bills ────────────────────────────────────────────────────────
  if (/\bloan\b|mortgage|insurance|aviva|legal & general|admiral|comparethemarket|clearscore|experian|barclaycard|\bamex\b|american express|payplan|stepchange|debt management|\brci\b|black horse|hire purchase/i.test(desc))
    return { category: "Finance & Bills", exclude: false };

  // ── Bank Fees ──────────────────────────────────────────────────────────────
  if (/\bfee\b|bank charge|overdraft fee|monthly charge|account fee|interest charged/i.test(desc))
    return { category: "Bank Fees", exclude: false };

  // ── Bank Transfers (remaining) ─────────────────────────────────────────────
  if (/standing order|faster payment|\bfp\b|sent to|bank transfer|payment reference/i.test(desc))
    return { category: "Bank Transfers", exclude: false };

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
