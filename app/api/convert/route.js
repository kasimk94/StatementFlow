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

    console.log("=== CONVERSION SUCCESS ===", transactions.length, "transactions");

    return NextResponse.json({
      transactions,
      totalIncome,
      totalExpenses,
      netBalance,
      transactionCount: transactions.length,
      confidence: "high",
      bank: "ai-parsed",
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
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are an expert UK bank statement parser. Extract ALL transactions accurately.

CRITICAL RULES:
1. Debits (money OUT) = NEGATIVE amount + type "debit"
2. Credits (money IN) = POSITIVE amount + type "credit"
3. NEVER miss a transaction
4. Clean merchant names: remove reference numbers, convert to readable names
5. Date format: DD/MM/YYYY always

Return ONLY valid JSON array:
[{"date":"DD/MM/YYYY","description":"Merchant Name","amount":-45.50,"type":"debit","balance":null}]

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

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Claude did not return valid JSON. Response: " + text.substring(0, 100));
  }

  return JSON.parse(jsonMatch[0]);
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

  if (type === "credit" || amount > 0) {
    if (["salary","wages","payroll","bacs","employer","hmrc","universal credit","benefits","pension","dividend"].some(s => desc.includes(s))) return "Income";
    if (["refund","cashback","reversal","chargeback"].some(s => desc.includes(s)))                                                             return "Refunds";
    if (["transfer","faster payment","fpay","sent from"].some(s => desc.includes(s)))                                                         return "Transfers In";
    return "Income";
  }

  if (["tesco","sainsbury","asda","morrisons","waitrose","lidl","aldi","co-op","m&s food","marks","iceland","farmfoods","ocado","booths"].some(s => desc.includes(s)))                                                                                                                              return "Groceries";
  if (["mcdonald","kfc","subway","pizza","nandos","wagamama","greggs","pret","costa","starbucks","cafe","restaurant","deliveroo","just eat","uber eat","domino","burger king","five guys","itsu","wasabi","leon"].some(s => desc.includes(s)))                                                       return "Eating Out";
  if (["tfl","trainline","national rail","gwr","lner","avanti","southeastern","thameslink","great western","parking","bp","shell","esso","texaco","petrol","fuel","bus","taxi","black cab","addison lee"].some(s => desc.includes(s)))                                                              return "Transport";
  if (["uber"].some(s => desc.includes(s)) && !["uber eat"].some(s => desc.includes(s)))                                                                                                                                                                                                          return "Transport";
  if (["amazon","asos","ebay","primark","next","h&m","zara","argos","currys","john lewis","ikea","b&q","jd sport","nike","adidas","boohoo","pretty little thing","shein","very","littlewoods","ao.com","apple store"].some(s => desc.includes(s)))                                                 return "Shopping";
  if (["netflix","spotify","disney","youtube premium","now tv","amazon prime","microsoft","adobe","google","playstation","xbox game","nintendo","hulu","paramount","discovery","apple"].some(s => desc.includes(s)))                                                                               return "Subscriptions";
  if (["british gas","octopus","eon","edf","bulb","ovo energy","scottish power","npower","thames water","severn trent","anglian water","council tax","bt ","virgin media","sky ","vodafone","o2","ee ","three","talktalk","insurance","aviva","axa","legal general","direct line"].some(s => desc.includes(s))) return "Bills & Utilities";
  if (["mortgage","rent","landlord","letting"].some(s => desc.includes(s)))                                                                                                                                                                                                                        return "Rent & Mortgage";
  if (["pharmacy","boots","lloyds pharmacy","chemist","dentist","doctor","nhs","gym","fitness","puregym","david lloyd","virgin active","health","medical","hospital","specsavers","vision express"].some(s => desc.includes(s)))                                                                    return "Health & Fitness";
  if (["cinema","odeon","vue","cineworld","showcase","theatre","ticketmaster","eventbrite","steam","playstation store","xbox","game ","bowling","laser","escape room"].some(s => desc.includes(s)))                                                                                                return "Entertainment";
  if (["atm","cash","cashpoint","withdrawal"].some(s => desc.includes(s)))                                                                                                                                                                                                                         return "Cash";
  if (["transfer","paypal","revolut","monzo","starling","wise","western union","currency","loan","credit card","standing order"].some(s => desc.includes(s)))                                                                                                                                      return "Transfers";
  if (["fee","charge","interest","overdraft","bank charge"].some(s => desc.includes(s)))                                                                                                                                                                                                           return "Bank Fees";

  return "Other";
}
