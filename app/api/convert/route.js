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

    // Truncate very large statements before sending to AI
    const textForParsing = rawText.length > 50000 ? rawText.substring(0, 50000) : rawText;

    // ── 5. Parse with Claude ────────────────────────────────────────────────
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

    // ── 6. Normalise + categorise ───────────────────────────────────────────
    const transactions = parsed
      .map((t) => {
        const amount =
          typeof t.amount === "number"
            ? t.amount
            : parseFloat(String(t.amount).replace(/[^0-9.\-]/g, "")) || 0;
        return {
          date:        normaliseDate(t.date),
          description: (t.description || "Transaction").trim(),
          amount,
          type:        t.type || (amount >= 0 ? "credit" : "debit"),
          category:    categoriseTransaction(t.description, amount, t.type),
        };
      })
      .filter((t) => t.date && !isNaN(t.amount));

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: "Could not normalise any transactions from the parsed data. Please try again." },
        { status: 400 }
      );
    }

    const totalIncome   = transactions.filter(t => t.type === "credit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpenses = transactions.filter(t => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netBalance    = totalIncome - totalExpenses;

    // ── 7. Generate AI insights (separate cheap call) ───────────────────────
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
// Claude AI parser
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
  // Strip markdown code fences
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  if (start === -1) {
    throw new Error("No JSON array found in response: " + cleaned.substring(0, 100));
  }

  // Try full array first
  const end = cleaned.lastIndexOf("]");
  if (end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.substring(start, end + 1));
    } catch (e) {
      console.log("Full parse failed, trying repair...");
    }
  }

  // Truncated response — repair by finding last complete object
  let jsonStr = cleaned.substring(start);
  const lastComma = jsonStr.lastIndexOf("},");
  if (lastComma !== -1) {
    try {
      return JSON.parse(jsonStr.substring(0, lastComma + 1) + "]");
    } catch (e) {
      console.log("Repair (},) failed:", e.message);
    }
  }

  // Last resort — last closing brace
  const lastBrace = jsonStr.lastIndexOf("}");
  if (lastBrace !== -1) {
    try {
      return JSON.parse(jsonStr.substring(0, lastBrace + 1) + "]");
    } catch (e) {
      throw new Error("Could not parse JSON: " + e.message);
    }
  }

  throw new Error("No valid JSON found");
}

async function parseWithClaude(rawText, apiKey) {
  const processedText = extractTransactionLines(rawText);
  console.log("Sending to Claude, text length:", processedText.length);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `CRITICAL: You MUST return complete valid JSON only. No markdown backticks. No explanation. Start response with [ and end with ]

You are an expert UK bank statement parser. Extract ALL transactions accurately.

CRITICAL RULES:
1. Debits (money OUT) = NEGATIVE amount + type "debit"
2. Credits (money IN) = POSITIVE amount + type "credit"
3. NEVER miss a transaction
4. Clean merchant names: remove reference numbers, convert to readable names
5. Date format: DD/MM/YYYY always

Return ONLY valid JSON array:
[{"date":"DD/MM/YYYY","description":"Merchant Name","amount":-45.50,"type":"debit","balance":null}]

IMPORTANT: Return raw JSON only. No markdown. No backticks. Start with [ end with ]

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

  if (data.error) {
    throw new Error(`Claude API: ${data.error.type} - ${data.error.message}`);
  }

  const text = data.content?.[0]?.text?.trim() ?? "";
  console.log("Claude text response:", text.substring(0, 300));

  return extractJSON(text);
}

// ---------------------------------------------------------------------------
// Subscription detector
// ---------------------------------------------------------------------------
function detectSubscriptions(transactions) {
  const knownSubscriptions = [
    "netflix","spotify","disney","disney+","apple music","apple tv",
    "amazon prime","prime video","now tv","nowtv","sky cinema","sky sports",
    "microsoft 365","microsoft office","adobe","creative cloud",
    "youtube premium","google one","google storage",
    "playstation plus","ps plus","xbox game pass","nintendo online",
    "audible","kindle unlimited",
    "gym","puregym","david lloyd","virgin active","anytime fitness","the gym",
    "duolingo","headspace","calm",
    "dropbox","icloud","onedrive",
    "linkedin premium","indeed","canva",
    "deliveroo plus","uber one",
    "times","telegraph","guardian","ft.com","financial times",
    "insurance","aviva","axa","direct line","admiral",
    "aa membership","rac membership",
    "vodafone","o2","ee","three","bt","sky broadband","virgin media","talktalk",
    "council tax","tv licence",
  ];

  const neverSubscriptions = [
    "tesco","sainsbury","asda","morrisons","waitrose","lidl","aldi",
    "co-op","marks spencer","m&s","iceland","farmfoods","ocado",
    "amazon marketplace","amzn",
    "argos","currys","john lewis","ikea","next","primark","asos",
    "mcdonald","kfc","subway","burger king","greggs","pret",
    "costa","starbucks","cafe","restaurant",
    "deliveroo","just eat","uber eats",
    "uber","bolt","taxi","tfl","trainline",
    "petrol","bp","shell","esso",
    "boots","pharmacy","chemist",
    "atm","cash","withdrawal",
    "paypal","transfer","faster payment",
  ];

  const subscriptions = [];
  const debitTransactions = transactions.filter(t => t.type === "debit");

  // Returns true if description looks like a person's name (e.g. "John Smith")
  function looksLikePersonName(name) {
    const words = name.trim().split(/\s+/);
    if (words.length < 2 || words.length > 3) return false;
    return words.every(w => /^[A-Z][a-z]+$/.test(w));
  }

  debitTransactions.forEach(t => {
    const desc = t.description.toLowerCase();
    const isKnownSub      = knownSubscriptions.some(sub  => desc.includes(sub));
    const isRegularShop   = neverSubscriptions.some(shop => desc.includes(shop));

    // Skip person-to-person payments (e.g. "John Smith")
    if (looksLikePersonName(t.description)) return;

    // Skip finance/mortgage/rent payments
    if (["financial services","rci","loan","mortgage","rent","landlord","letting"].some(s => desc.includes(s))) return;

    // Special case: "amazon" alone = shopping, "amazon prime" = subscription (handled by knownSubscriptions)
    const isAmazonRegular = /\bamazon\b/.test(desc) && !desc.includes("amazon prime") && !desc.includes("prime video");
    if (isAmazonRegular) return;

    if (isKnownSub && !isRegularShop) {
      const existing = subscriptions.find(s => s.name === t.description);
      if (existing) {
        existing.total += Math.abs(t.amount);
        existing.count++;
      } else {
        subscriptions.push({ name: t.description, amount: Math.abs(t.amount), total: Math.abs(t.amount), count: 1 });
      }
      return;
    }

    // Pattern detection: same merchant, exact same amount, 2+ times — but not regular shopping
    if (!isRegularShop && !isKnownSub) {
      const sameAmountSameMerchant = debitTransactions.filter(
        t2 => t2.description === t.description && Math.abs(Math.abs(t2.amount) - Math.abs(t.amount)) < 0.01
      );
      if (sameAmountSameMerchant.length >= 2 && !subscriptions.find(s => s.name === t.description)) {
        subscriptions.push({
          name:     t.description,
          amount:   Math.abs(t.amount),
          total:    Math.abs(t.amount) * sameAmountSameMerchant.length,
          count:    sameAmountSameMerchant.length,
          detected: "pattern",
        });
      }
    }
  });

  const total = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  return { list: subscriptions, total, count: subscriptions.length };
}

// ---------------------------------------------------------------------------
// AI Insights generator
// ---------------------------------------------------------------------------
async function generateInsights(transactions, apiKey) {
  const totalIncome   = transactions.filter(t => t.type === "credit").reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "debit").reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categories = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount);
  });

  const detected = detectSubscriptions(transactions);
  const subscriptionTotal = detected.total;

  const merchantTotals = {};
  transactions.filter(t => t.type === "debit").forEach(t => {
    merchantTotals[t.description] = (merchantTotals[t.description] || 0) + Math.abs(t.amount);
  });
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  const summaryData = {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    transactionCount: transactions.length,
    categories,
    subscriptions: {
      total: subscriptionTotal,
      list:  detected.list.map(s => `${s.name} £${s.amount.toFixed(2)}`),
      count: detected.count,
    },
    topMerchants,
    dateRange: {
      first: transactions[transactions.length - 1]?.date,
      last:  transactions[0]?.date,
    },
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a friendly UK personal finance assistant. Analyse this spending summary and return a JSON object with insights.

IMPORTANT - SUBSCRIPTIONS: The subscriptions list has already been accurately detected. Use ONLY the provided subscriptions data. Do NOT reclassify Amazon, Tesco, Deliveroo or any shopping/food as subscriptions — those are regular purchases, not recurring fixed-fee services. Subscriptions are ONLY fixed recurring services like Netflix, Spotify, gym memberships, phone bills, insurance etc.

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
// Date normaliser  DD/MM/YYYY → DD MMM YYYY
// ---------------------------------------------------------------------------
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function normaliseDate(raw) {
  if (!raw) return "";
  const s = String(raw).trim();

  // DD/MM/YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m1) {
    const d  = m1[1].padStart(2, "0");
    const mo = parseInt(m1[2], 10) - 1;
    const y  = m1[3];
    if (mo >= 0 && mo < 12) return `${d} ${MONTHS[mo]} ${y}`;
  }

  // YYYY-MM-DD (ISO)
  const m2 = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m2) {
    const y  = m2[1];
    const mo = parseInt(m2[2], 10) - 1;
    const d  = m2[3].padStart(2, "0");
    if (mo >= 0 && mo < 12) return `${d} ${MONTHS[mo]} ${y}`;
  }

  // Already readable (e.g. "15 Mar 2026")
  if (/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(s)) return s;

  return s;
}

// ---------------------------------------------------------------------------
// Categorisation
// ---------------------------------------------------------------------------
function categoriseTransaction(description, amount, type) {
  const desc = (description || "").toLowerCase();

  // Detect person-to-person payments: "First Last" or "First Middle Last"
  function looksLikePersonName(d) {
    const words = (d || "").trim().split(/\s+/);
    return words.length >= 2 && words.length <= 3 && words.every(w => /^[A-Z][a-z]+$/.test(w));
  }

  if (type === "credit" || amount > 0) {
    if (looksLikePersonName(description))                                                                                                      return "Bank Transfers";
    if (["salary","wages","payroll","bacs","employer","hmrc","universal credit","benefits","pension","dividend"].some(s => desc.includes(s))) return "Income & Salary";
    if (["refund","cashback","reversal","chargeback"].some(s => desc.includes(s)))                                                             return "Refunds";
    if (["transfer","faster payment","fpay","sent from"].some(s => desc.includes(s)))                                                         return "Bank Transfers";
    return "Income & Salary";
  }

  if (["tesco","sainsbury","asda","morrisons","waitrose","lidl","aldi","co-op","m&s food","marks","iceland","farmfoods","ocado","booths"].some(s => desc.includes(s)))                                                                                                                              return "Supermarkets & Food";
  if (["mcdonald","kfc","subway","pizza","nandos","wagamama","greggs","pret","costa","starbucks","cafe","restaurant","deliveroo","just eat","uber eat","domino","burger king","five guys","itsu","wasabi","leon"].some(s => desc.includes(s)))                                                       return "Eating & Drinking";
  if (["tfl","trainline","national rail","gwr","lner","avanti","southeastern","thameslink","great western","parking","bp","shell","esso","texaco","petrol","fuel","bus","taxi","black cab","addison lee"].some(s => desc.includes(s)))                                                              return "Travel & Transport";
  if (["uber"].some(s => desc.includes(s)) && !["uber eat"].some(s => desc.includes(s)))                                                                                                                                                                                                          return "Travel & Transport";
  // Subscriptions checked BEFORE shopping so "amazon prime" beats "amazon"
  if (["netflix","spotify","disney","youtube premium","now tv","amazon prime","prime video","microsoft 365","microsoft office","adobe","creative cloud","google one","playstation plus","ps plus","xbox game pass","nintendo online","audible","kindle unlimited","duolingo","headspace","calm","dropbox","icloud","onedrive","linkedin premium","deliveroo plus","uber one"].some(s => desc.includes(s))) return "Subscriptions & Streaming";
  if (["amazon","amzn","asos","ebay","primark","next","h&m","zara","argos","currys","john lewis","ikea","b&q","jd sport","nike","adidas","boohoo","pretty little thing","shein","very","littlewoods","ao.com","apple store"].some(s => desc.includes(s)))                                      return "Online & High Street";
  if (["british gas","octopus","eon","edf","bulb","ovo energy","scottish power","npower","thames water","severn trent","anglian water","council tax","bt ","virgin media","sky ","vodafone","o2","ee ","three","talktalk","insurance","aviva","axa","legal general","direct line"].some(s => desc.includes(s))) return "Household Bills";
  if (["mortgage","rent","landlord","letting"].some(s => desc.includes(s)))                                                                                                                                                                                                                        return "Rent & Mortgage";
  if (["pharmacy","boots","lloyds pharmacy","chemist","dentist","doctor","nhs","gym","fitness","puregym","david lloyd","virgin active","health","medical","hospital","specsavers","vision express"].some(s => desc.includes(s)))                                                                    return "Health & Fitness";
  if (["cinema","odeon","vue","cineworld","showcase","theatre","ticketmaster","eventbrite","steam","playstation store","xbox","game ","bowling","laser","escape room"].some(s => desc.includes(s)))                                                                                                return "Entertainment & Leisure";
  if (["atm","cash","cashpoint","withdrawal"].some(s => desc.includes(s)))                                                                                                                                                                                                                         return "Cash & ATM";
  if (["transfer","paypal","revolut","monzo","starling","wise","western union","currency","loan","credit card","standing order"].some(s => desc.includes(s)))                                                                                                                                      return "Bank Transfers";
  if (["fee","charge","interest","overdraft","bank charge"].some(s => desc.includes(s)))                                                                                                                                                                                                           return "Bank Fees";
  if (["standing order","faster payment","fp ","sent to","received from","bank transfer"].some(s => desc.includes(s)))                                                                                                                                                                             return "Bank Transfers";
  if (["financial","services","rci","lloyds","barclays","hsbc","natwest","halifax","nationwide","santander","monzo","starling","revolut"].some(s => desc.includes(s)))                                                                                                                              return "Finance & Bills";

  return "Uncategorised";
}
