import { NextResponse } from "next/server";
import { extractText } from "unpdf";

// ---------------------------------------------------------------------------
// STAGE 1 – Text cleaning
// ---------------------------------------------------------------------------

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// STAGE 2 – Date patterns
// ---------------------------------------------------------------------------

const MON = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;

const DATE_PATTERN_SOURCES = [
  [String.raw`\d{1,2}\s+` + MON + String.raw`\s+\d{4}`, "gi"],
  [String.raw`\d{1,2}\s+` + MON, "gi"],
  [MON + String.raw`\s+\d{1,2},?\s+\d{4}`, "gi"],
  [String.raw`\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}`, "g"],
];

const REFERENCE_DATE_PREFIX = /\b(on|at|dated?|processed|value)\s+$/i;

function findAllDates(text) {
  const found = new Map();
  for (const [src, flags] of DATE_PATTERN_SOURCES) {
    const re = new RegExp(`(${src})`, flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(Math.max(0, m.index - 10), m.index);
      if (REFERENCE_DATE_PREFIX.test(before)) continue;
      if (!found.has(m.index)) {
        found.set(m.index, { text: m[1], index: m.index, length: m[1].length });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}

function findFirstDate(str) {
  for (const [src, flags] of DATE_PATTERN_SOURCES) {
    const re = new RegExp(`(${src})`, flags);
    const m = re.exec(str);
    if (m) return { text: m[1], index: m.index, length: m[1].length };
  }
  return null;
}

// ---------------------------------------------------------------------------
// STAGE 3 – Amount detection
// ---------------------------------------------------------------------------

const AMT_SRC = String.raw`(?<![.\d])-?\s*£?(?:\d{1,6}(?:,\d{3})*|\d+)\.\d{2}(?!\d)`;
const AMT_SUFFIX_SRC = String.raw`\s*(?:(CR)|(DR))?(?=\s|$|[,)])`;

function findAmounts(str) {
  const re = new RegExp(`(${AMT_SRC})${AMT_SUFFIX_SRC}`, "gi");
  const results = [];
  let m;
  while ((m = re.exec(str)) !== null) {
    const raw = m[1].trim();
    const suffix = m[2] ? "CR" : m[3] ? "DR" : "";
    const value = parseFloat(raw.replace(/[£,\s]/g, ""));
    if (!isNaN(value)) results.push({ raw, value, index: m.index, suffix });
  }
  return results;
}

// ---------------------------------------------------------------------------
// STAGE 4 – Income / expense / refund classification
// ---------------------------------------------------------------------------

// "Refund From" counts as income (positive) but gets its own "Refunds" category
const REFUND_KEYWORDS   = [/refund\s+from/i, /\brefund\b/i];
const INCOME_KEYWORDS   = [
  /received\s+from/i,
  /\bhmrc\b/i,
  /\bsalary\b/i,
  /\bwages\b/i,
  /faster\s+payment\s+received/i,
  /bacs\s+credit/i,
  /payment\s+from/i,
  /transfer\s+in/i,
  /money\s+in/i,
  /interest\s+paid/i,
];
// Explicit expense signals that should never be reclassified as income
const FORCE_EXPENSE = [/unpaid\s+direct\s+debit/i, /returned\s+direct\s+debit/i];

// Returns "income" | "refund" | "expense"
function classifyType(rawSection, suffix) {
  if (suffix === "DR") return "expense";
  for (const re of FORCE_EXPENSE) if (re.test(rawSection)) return "expense";
  if (suffix === "CR") return "income";
  for (const re of REFUND_KEYWORDS)  if (re.test(rawSection)) return "refund";
  for (const re of INCOME_KEYWORDS)  if (re.test(rawSection)) return "income";
  return "expense";
}

// ---------------------------------------------------------------------------
// STAGE 5 – Description cleaning
// ---------------------------------------------------------------------------

const DESC_PREFIXES = [
  [/^cash\s+machine\s+withdrawal\s+at\s+.*/i, "ATM Withdrawal"],
  [/^cash\s+withdrawal\s+.*/i,                "ATM Withdrawal"],
  [/^card\s+payment\s+to\s+/i,                ""],
  [/^contactless\s+payment\s+to\s+/i,         ""],
  [/^contactless\s+/i,                        ""],
  [/^direct\s+debit\s+to\s+/i,               ""],
  [/^unpaid\s+direct\s+debit\s+to\s+/i,      "Unpaid DD – "],
  [/^bill\s+payment\s+to\s+/i,               ""],
  [/^standing\s+order\s+to\s+/i,             ""],
  [/^faster\s+payment\s+to\s+/i,             ""],
  [/^transfer\s+to\s+/i,                     ""],
  [/^received\s+from\s+/i,                   ""],
  [/^refund\s+from\s+/i,                     ""],
  [/^payment\s+from\s+/i,                    ""],
  [/^paid\s+to\s+/i,                         ""],
];

function cleanDescription(rawSection) {
  let d = rawSection
    .replace(new RegExp(AMT_SRC, "gi"), "")
    .replace(/\b(CR|DR)\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  for (const [re, replacement] of DESC_PREFIXES) {
    if (re.test(d)) {
      if (replacement !== "" && !replacement.endsWith("– ")) return replacement;
      d = d.replace(re, replacement);
      break;
    }
  }

  d = d
    .replace(/\s+on\s+\d{1,2}\s+[A-Za-z]{3}\b.*/i, "")
    .replace(/\s+ref(?:erence)?[:\s]+\S+(\s+\S+)*/i, "")
    .replace(/\*\s*\d[\d\-\s]*/g, "")
    .replace(/\*+/g, "")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\s+\b(Serv|Svcs?|Svc|Grp|Intl|Ltd|Plc|Inc|Corp|Co|UK|GB)\b\.?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (d.length > 50) d = d.slice(0, 50).replace(/\s+\S+$/, "").trim();
  return d || "Transaction";
}

// ---------------------------------------------------------------------------
// STAGE 5b – Category assignment
// ---------------------------------------------------------------------------

const CATEGORY_RULES = [
  {
    name: "Groceries",
    patterns: [/tesco/i, /sainsbury/i, /\basda\b/i, /\blidl\b/i, /\baldi\b/i,
               /morrisons/i, /waitrose/i, /\biceland\b/i, /marks\s*[&and]+\s*spencer/i,
               /\bm&s\b/i, /\bm\s+&\s+s\b/i, /co-?op\s+food/i],
  },
  {
    name: "Shopping",
    patterns: [/\bamazon\b/i, /amznmktplace/i, /amzn/i, /\bebay\b/i, /\bargos\b/i,
               /\bikea\b/i, /\bprimark\b/i, /\bnext\b/i, /\basos\b/i, /\bboohoo\b/i,
               /very\.co/i, /\bcurry/i, /\bjohn\s+lewis\b/i],
  },
  // Fast Food checked before general Eating Out so specific chains match here
  {
    name: "Fast Food",
    patterns: [/nandos/i, /mcdonald/i, /\bkfc\b/i, /\bsubway\b/i, /burger\s*king/i,
               /\bgreggs/i, /\bpizza\b/i, /domino/i, /papa\s*john/i, /five\s+guys/i,
               /leon\s+restaurant/i],
  },
  {
    name: "Eating Out",
    patterns: [/restaurant/i, /\bcafe\b/i, /coffee/i, /deliveroo/i, /uber\s*eats/i,
               /just\s*eat/i, /dessert/i, /\bbistro\b/i, /pret\b/i, /costa\b/i,
               /starbucks/i, /caffe\s+nero/i],
  },
  {
    name: "Transport",
    patterns: [/\btfl\b/i, /transport\s+for\s+london/i, /\btrain\b/i, /\bbus\b/i,
               /parking/i, /petrol/i, /\bshell\b/i, /\bbp\b/i, /\besso\b/i,
               /national\s+rail/i, /trainline/i, /\blyft\b/i, /\bnational\s+express\b/i],
  },
  // Uber after transport so "Uber Eats" stays in Eating Out but "Uber" alone → Transport
  {
    name: "Transport",
    patterns: [/\buber\b/i],
  },
  {
    name: "Entertainment",
    patterns: [/netflix/i, /spotify/i, /disney/i, /cinema/i, /theatre/i,
               /\bsteam\b/i, /youtube\s+premium/i, /prime\s+video/i, /apple\s+tv/i,
               /ticketmaster/i, /sky\s+cinema/i, /\bxbox\b/i, /\bplaystation\b/i],
  },
  {
    name: "Health & Beauty",
    patterns: [/pharmacy/i, /superdrug/i, /\bboots\b/i, /\bgym\b/i, /fitness/i,
               /holland\s+&?\s*barrett/i, /\bnhs\b/i, /dental/i, /optician/i,
               /\bspa\b/i, /\bsalon\b/i],
  },
  {
    name: "Bills & Finance",
    patterns: [/direct\s+debit/i, /council\s+tax/i, /\bwater\b/i, /\bgas\b/i,
               /electric/i, /\bbarclays\b/i, /insurance/i, /broadband/i,
               /vodafone/i, /voda\b/i, /\bthree\b/i, /\bo2\b/i, /\bee\b/i,
               /\bsky\b/i, /virgin\s+media/i, /bill\s+payment/i, /standing\s+order/i,
               /council/i, /unpaid\s+dd/i],
  },
  {
    name: "ATM & Cash",
    patterns: [/\batm\b/i, /cash\s+machine/i, /\bwithdrawal\b/i, /atm\s+withdrawal/i,
               /cardtronics/i, /post\s+office\s+cash/i],
  },
  {
    name: "Charity & Donations",
    patterns: [/islamic\s+relief/i, /muslim\s+aid/i, /penny\s+appeal/i, /human\s+appeal/i,
               /red\s+cross/i, /\boxfam\b/i, /\bdonation\b/i, /\bcharity\b/i,
               /\bmuslim\b/i, /\bmap\b/i, /www\.map/i, /cancer\s+research/i,
               /save\s+the\s+children/i],
  },
  {
    name: "Transfers",
    patterns: [/\bmonzo\b/i, /\bpaypal\b/i, /bank\s+transfer/i, /\brevolut\b/i,
               /\bwise\b/i, /\bcash\s+app\b/i, /\bchaps\b/i],
  },
  {
    name: "Vaping & Tobacco",
    patterns: [/\bvape\b/i, /\bvapes\b/i, /vaping/i, /cloud\s+city/i, /\btobacco\b/i,
               /e-?cig/i, /\bjuul\b/i],
  },
];

function categorize(rawSection, cleanedDescription, type) {
  // Refunds are positive money but deserve their own bucket
  if (type === "refund") return "Refunds";
  if (type === "income") return "Income";

  const combined = rawSection + " " + cleanedDescription;

  for (const { name, patterns } of CATEGORY_RULES) {
    for (const re of patterns) {
      if (re.test(combined)) return name;
    }
  }

  return "Unknown \u26a0\ufe0f";
}

// ---------------------------------------------------------------------------
// STAGE 6 – Skip-line rules (FIX 1)
// ---------------------------------------------------------------------------

const SKIP_PATTERNS = [
  /start\s+balance/i,
  /end\s+balance/i,
  /opening\s+balance/i,
  /closing\s+balance/i,
  /balance\s+brought\s+forward/i,
  /balance\s+carried\s+forward/i,
  /sort\s+code\s+20/i,
  /\bsort\s+code\b/i,
  /account\s+number/i,
  /account\s+no\b/i,
  /\biban\b/i,
  /\bswift\b/i,
  /statement\s+date/i,
  /date\s+description/i,
  /financial\s+conduct\s+authority/i,
  /prudential\s+regulation\s+authority/i,
  /registered\s+in\s+england/i,
  /registered\s+office/i,
  /authorised\s+by/i,
  /will\s+be\s+debited\s+to\s+this\s+account/i,
  /charges\s+are\s+summarised/i,
  /help\s+you\s+budget/i,
  /appear\s+on\s+your\s+next\s+statement/i,
  /barclays\s+bank\s+uk\s+plc/i,
  /financial\s+services\s+register/i,
  /\bpage\s+\d/i,
  /\bcontinued\b/i,
  /your\s+statement/i,
  /current\s+account\s+statement/i,
];

function shouldSkip(text) {
  if (text.trim().length < 4) return true;
  return SKIP_PATTERNS.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// PRIMARY PARSER
// ---------------------------------------------------------------------------

function primaryParse(text) {
  const transactions = [];
  const dateMarkers = findAllDates(text);
  if (dateMarkers.length === 0) return transactions;

  for (let i = 0; i < dateMarkers.length; i++) {
    const { text: dateText, index, length } = dateMarkers[i];
    const sectionStart = index + length;
    const sectionEnd =
      i + 1 < dateMarkers.length ? dateMarkers[i + 1].index : text.length;
    const section = text.slice(sectionStart, sectionEnd).trim();

    if (!section || shouldSkip(dateText + " " + section)) continue;

    const amounts = findAmounts(section);
    if (amounts.length === 0) continue;

    const txAmounts = amounts.length > 1 ? amounts.slice(0, -1) : amounts;

    for (const { value, index: amtIdx, suffix } of txAmounts) {
      const rawSection = section.slice(0, amtIdx).trim();
      if (shouldSkip(rawSection)) continue;

      const type = classifyType(rawSection, suffix);
      const description = cleanDescription(rawSection);
      const category = categorize(rawSection, description, type);
      // Both income and refund are positive; expense is negative
      const amount = type === "expense" ? -Math.abs(value) : Math.abs(value);

      transactions.push({ date: dateText, description, amount, type, category });
    }
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// FALLBACK PARSER
// ---------------------------------------------------------------------------

function fallbackParse(text) {
  const transactions = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (shouldSkip(line)) continue;
    const dateMatch = findFirstDate(line);
    if (!dateMatch) continue;
    const amounts = findAmounts(line);
    if (amounts.length === 0) continue;

    const { value, suffix } = amounts[0];
    const rawSection = line.replace(dateMatch.text, "").trim();
    if (shouldSkip(rawSection)) continue;

    const type = classifyType(rawSection, suffix);
    const description = cleanDescription(rawSection);
    const category = categorize(rawSection, description, type);
    const amount = type === "expense" ? -Math.abs(value) : Math.abs(value);

    transactions.push({ date: dateMatch.text, description, amount, type, category });
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// API route
// ---------------------------------------------------------------------------

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mime = file.type || "";
    if (!mime.includes("pdf") && !file.name?.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const { text: rawText } = await extractText(new Uint8Array(arrayBuffer), {
      mergePages: true,
    });

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from this PDF. It may be a scanned image." },
        { status: 422 }
      );
    }

    const text = cleanText(rawText);
    let transactions = primaryParse(text);

    if (transactions.length < 3) {
      const fallback = fallbackParse(text);
      if (fallback.length > transactions.length) transactions = fallback;
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transactions could be detected. The PDF text was extracted but no recognisable date + amount pairs were found.",
          rawTextPreview: text.slice(0, 600),
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ transactions, count: transactions.length });
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json(
      { error: "Failed to process the PDF: " + err.message },
      { status: 500 }
    );
  }
}
