import { NextResponse } from "next/server";
import { extractText } from "unpdf";

// Note: unpdf is used for PDF text extraction (ESM-compatible, already installed).
// pdf-parse is available as a fallback but has known Next.js App Router compatibility
// issues with its test-file loading at import time.

// ---------------------------------------------------------------------------
// POST /api/convert
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // ── 1. Extract raw text from PDF ────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    let rawText = "";
    try {
      const result = await extractText(uint8, { mergePages: true });
      rawText = Array.isArray(result.text) ? result.text.join("\n") : (result.text || "");
    } catch {
      return NextResponse.json(
        { error: "Could not read this PDF. It may be corrupted or password-protected." },
        { status: 400 }
      );
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract text from this PDF. It may be a scanned image — please use a text-based PDF downloaded from your online banking." },
        { status: 400 }
      );
    }

    // ── 2. Parse with Claude AI ─────────────────────────────────────────────
    let parsed;
    try {
      parsed = await parseWithClaude(rawText);
    } catch (err) {
      console.error("Claude parsing error:", err);
      return NextResponse.json(
        { error: "AI parsing failed. Please try again or use a different statement." },
        { status: 502 }
      );
    }

    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        { error: "No transactions found in this statement. Please check the file is a valid bank statement." },
        { status: 400 }
      );
    }

    // ── 3. Normalise + categorise ───────────────────────────────────────────
    const transactions = parsed
      .map((t) => {
        const amount = typeof t.amount === "number" ? t.amount : parseFloat(String(t.amount).replace(/[^0-9.\-]/g, "")) || 0;
        return {
          date:        normaliseDate(t.date),
          description: (t.description || "Transaction").trim(),
          amount,
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

    return NextResponse.json({
      transactions,
      confidence: "high",
      bank:       "ai-parsed",
    });

  } catch (error) {
    console.error("Unhandled convert error:", error);
    return NextResponse.json(
      { error: "Failed to process statement. Please try again." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Claude AI parser
// ---------------------------------------------------------------------------
function preprocessText(rawText) {
  const lines = rawText.split("\n");
  const relevant = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length < 3) return false;
    const hasDate   = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(trimmed);
    const hasAmount = /£[\d,]+\.?\d*|\d+\.\d{2}/.test(trimmed);
    const hasNumber = /\d/.test(trimmed);
    return hasDate || hasAmount || (hasNumber && trimmed.length > 5);
  });
  return relevant.join("\n").substring(0, 6000);
}

async function parseWithClaude(rawText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set");

  const textChunk = preprocessText(rawText);

  const prompt = `You are the world's most accurate UK bank statement parser. You have expert knowledge of every UK bank format.

BANKS YOU MUST HANDLE PERFECTLY:
Traditional: Barclays, HSBC, Lloyds, NatWest, RBS, Santander, Halifax, Bank of Scotland, Nationwide, TSB, Metro Bank, Virgin Money, First Direct, Co-operative Bank
Digital: Monzo, Starling, Revolut, Chase UK, Tide, Mettle, Monese, Atom Bank
Building Societies: Nationwide, Yorkshire BS, Leeds BS, Coventry BS

HOW TO IDENTIFY DEBITS vs CREDITS FOR EACH BANK:

REVOLUT:
- Has columns: Date | Description | Amount | Balance
- Negative amounts (-£45.00) = DEBIT = money OUT
- Positive amounts (+£2500.00) = CREDIT = money IN

MONZO:
- Pot withdrawals TO account = CREDIT
- Pot deposits FROM account = DEBIT
- All purchases = DEBIT

STARLING:
- Has "Money In" and "Money Out" columns
- Money Out = DEBIT, Money In = CREDIT

CHASE UK:
- Negative amounts = DEBIT, Positive amounts = CREDIT
- Cashback = CREDIT

BARCLAYS:
- Has separate "Money Out" and "Money In" columns
- Money Out = DEBIT, Money In = CREDIT

HSBC / FIRST DIRECT:
- Has "Paid Out" and "Paid In" columns
- Paid Out = DEBIT, Paid In = CREDIT

LLOYDS / HALIFAX / BANK OF SCOTLAND:
- Has "Debit" and "Credit" columns
- Debit column = DEBIT, Credit column = CREDIT

NATWEST / RBS:
- Has "Value" column with type codes
- Type DD/SO/TFR/POS = DEBIT
- Type CR/BAC = CREDIT

SANTANDER:
- Has "Money Out" and "Money In" columns
- Money Out = DEBIT, Money In = CREDIT

NATIONWIDE:
- Has "Payments Out" and "Payments In" columns
- Payments Out = DEBIT, Payments In = CREDIT

UNIVERSAL RULES (apply to ALL banks):
ALWAYS DEBIT (money leaving):
- Any purchase at a shop, restaurant, online retailer
- Netflix, Spotify, Disney+, Apple, Google, Microsoft subscriptions
- Utility bills, council tax, insurance payments
- Mortgage/rent payments
- ATM cash withdrawals
- Direct debits and standing orders going OUT
- Transfers sent TO another person

ALWAYS CREDIT (money coming in):
- Salary, wages, payroll from employer
- BACS payments, faster payments received
- HMRC tax credits, universal credit, benefits
- Refunds from merchants
- Cashback
- Transfers received FROM another person
- Interest earned

AMOUNT FORMAT RULES:
- DEBIT = ALWAYS return as NEGATIVE number e.g. -45.50
- CREDIT = ALWAYS return as POSITIVE number e.g. 2500.00
- NEVER return a shop purchase as positive
- NEVER return a salary as negative

MERCHANT NAME CLEANING:
Clean up ALL merchant names to be human readable:
- AMZNMKTPLACE / AMAZON / AMZ → Amazon
- TFL / TRANSPORT FOR LONDON → TfL
- MCDONALDS / MCDONALD → McDonald's
- TESCO STORES / TESCO EXPRESS → Tesco
- SAINSBURYS → Sainsbury's
- NETFLIX.COM → Netflix
- SPOTIFYABCDEF → Spotify
- JUST EAT / JUSTEAT → Just Eat
- UBER / UBEREATS → Uber
- Remove ALL reference numbers (long strings of digits/letters)
- Remove card numbers like **** 1234
- Remove sort codes
- Convert to proper Title Case

EXTRACT EVERY SINGLE TRANSACTION:
- Do not skip any transaction
- Include ALL debits and credits
- Include transfers, fees
- Extract from all pages

Return ONLY a valid JSON array. No explanation. No markdown. No backticks. No code fences.

Format:
[
  {
    "date": "DD/MM/YYYY",
    "description": "Clean Merchant Name",
    "amount": -45.50,
    "type": "debit",
    "balance": 1234.56
  }
]

If balance is not available use null.
Date must always be DD/MM/YYYY format.

BANK STATEMENT TEXT:
${textChunk}

Return ONLY the JSON array:`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "x-api-key":       apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Claude API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const rawResponse = data.content?.[0]?.text?.trim() ?? "";

  // Strip any accidental markdown fences
  const clean = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Find the JSON array (handle any leading/trailing text)
  const start = clean.indexOf("[");
  const end   = clean.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error(`Claude did not return a JSON array. Response: ${clean.substring(0, 200)}`);
  }

  return JSON.parse(clean.slice(start, end + 1));
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
    const d = m1[1].padStart(2, "0");
    const mo = parseInt(m1[2], 10) - 1;
    const y = m1[3];
    if (mo >= 0 && mo < 12) return `${d} ${MONTHS[mo]} ${y}`;
  }

  // YYYY-MM-DD (ISO)
  const m2 = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m2) {
    const y = m2[1];
    const mo = parseInt(m2[2], 10) - 1;
    const d = m2[3].padStart(2, "0");
    if (mo >= 0 && mo < 12) return `${d} ${MONTHS[mo]} ${y}`;
  }

  // Already looks readable (e.g. "15 Mar 2026")
  if (/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(s)) return s;

  return s; // return as-is if unrecognised
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

  if (["tesco","sainsbury","asda","morrisons","waitrose","lidl","aldi","co-op","m&s food","marks","iceland","farmfoods","ocado","booths"].some(s => desc.includes(s)))                                                                                                                                                                    return "Groceries";
  if (["mcdonald","kfc","subway","pizza","nandos","wagamama","greggs","pret","costa","starbucks","cafe","restaurant","deliveroo","just eat","uber eat","domino","burger king","five guys","itsu","wasabi","leon"].some(s => desc.includes(s)))                                                                                               return "Eating Out";
  if (["tfl","trainline","national rail","gwr","lner","avanti","southeastern","thameslink","great western","parking","bp","shell","esso","texaco","petrol","fuel","bus","taxi","black cab","addison lee"].some(s => desc.includes(s)))                                                                                                       return "Transport";
  if (["uber"].some(s => desc.includes(s)) && !["uber eat"].some(s => desc.includes(s)))                                                                                                                                                                                                                                                  return "Transport";
  if (["amazon","asos","ebay","primark","next","h&m","zara","argos","currys","john lewis","ikea","b&q","jd sport","nike","adidas","boohoo","pretty little thing","shein","very","littlewoods","ao.com","apple store"].some(s => desc.includes(s)))                                                                                         return "Shopping";
  if (["netflix","spotify","disney","youtube premium","now tv","amazon prime","microsoft","adobe","google","playstation","xbox game","nintendo","hulu","paramount","discovery","apple"].some(s => desc.includes(s)))                                                                                                                        return "Subscriptions";
  if (["british gas","octopus","eon","edf","bulb","ovo energy","scottish power","npower","thames water","severn trent","anglian water","council tax","bt ","virgin media","sky ","vodafone","o2","ee ","three","talktalk","insurance","aviva","axa","legal general","direct line"].some(s => desc.includes(s)))                            return "Bills & Utilities";
  if (["mortgage","rent","landlord","letting"].some(s => desc.includes(s)))                                                                                                                                                                                                                                                                return "Rent & Mortgage";
  if (["pharmacy","boots","lloyds pharmacy","chemist","dentist","doctor","nhs","gym","fitness","puregym","david lloyd","virgin active","health","medical","hospital","specsavers","vision express"].some(s => desc.includes(s)))                                                                                                            return "Health & Fitness";
  if (["cinema","odeon","vue","cineworld","showcase","theatre","ticketmaster","eventbrite","steam","playstation store","xbox","game ","bowling","laser","escape room"].some(s => desc.includes(s)))                                                                                                                                         return "Entertainment";
  if (["atm","cash","cashpoint","withdrawal"].some(s => desc.includes(s)))                                                                                                                                                                                                                                                                 return "Cash";
  if (["transfer","paypal","revolut","monzo","starling","wise","western union","currency","loan","credit card","standing order"].some(s => desc.includes(s)))                                                                                                                                                                               return "Transfers";
  if (["fee","charge","interest","overdraft","bank charge"].some(s => desc.includes(s)))                                                                                                                                                                                                                                                   return "Bank Fees";

  return "Other";
}
