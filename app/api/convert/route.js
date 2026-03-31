import { NextResponse } from "next/server";
import { extractText } from "unpdf";

// ---------------------------------------------------------------------------
// MERCHANT MAP – longest key matched first (greedy)
// ---------------------------------------------------------------------------

const MERCHANT_MAP = {
  // Amazon
  'AMAZON PRIME VIDEO': 'Amazon Prime', 'AMAZON PRIME': 'Amazon Prime',
  'AMAZON.CO.UK': 'Amazon', 'AMZNMKTPLACE': 'Amazon', 'AMAZON': 'Amazon',
  'AMZN': 'Amazon',
  // Supermarkets
  'TESCO EXPRESS': 'Tesco Express', 'TESCO EXTRA': 'Tesco Extra',
  'TESCO STORES': 'Tesco', 'TESCO': 'Tesco',
  'SAINSBURYS': "Sainsbury's", 'SAINSBURY': "Sainsbury's",
  'ASDA': 'ASDA', 'MORRISONS': 'Morrisons', 'WAITROSE': 'Waitrose',
  'LIDL': 'Lidl', 'ALDI': 'Aldi',
  'MARKS AND SPENCER': 'M&S', 'MARKSSPENCER': 'M&S',
  'CO-OPERATIVE': 'Co-op', 'COOPERATIVE': 'Co-op', 'COOP': 'Co-op',
  'ICELAND FOODS': 'Iceland', 'ICELAND': 'Iceland', 'FARMFOODS': 'Farmfoods',
  // Transport
  'TRANSPORT FOR LONDON': 'TfL', 'LONDON UNDERGROUND': 'TfL', 'OYSTER': 'TfL',
  'TFL': 'TfL',
  'UBER EATS': 'Uber Eats', 'UBER': 'Uber',
  'BOLT': 'Bolt', 'TRAINLINE': 'Trainline',
  'GWR': 'GWR Trains', 'LNER': 'LNER Trains',
  'NATIONAL RAIL': 'National Rail', 'AVANTI': 'Avanti West Coast',
  'NATIONAL EXPRESS': 'National Express', 'MEGABUS': 'Megabus',
  // Food & Drink
  'MCDONALDS UK': "McDonald's", 'MCDONALDS': "McDonald's", 'MCDONALD': "McDonald's",
  'STARBUCKS': 'Starbucks', 'COSTA COFFEE': 'Costa Coffee', 'COSTA': 'Costa Coffee',
  'CAFFE NERO': 'Caffè Nero', 'GREGGS': 'Greggs',
  'PRET A MANGER': 'Pret A Manger', 'PRET': 'Pret A Manger',
  'DELIVEROO': 'Deliveroo', 'JUST EAT': 'Just Eat', 'JUSTEAT': 'Just Eat',
  'KFC': 'KFC', 'SUBWAY': 'Subway',
  'DOMINOS': "Domino's", 'DOMINO': "Domino's", 'PIZZA HUT': 'Pizza Hut',
  'NANDOS': "Nando's", 'WAGAMAMA': 'Wagamama', 'LEON': 'Leon',
  'FIVE GUYS': 'Five Guys', 'BURGER KING': 'Burger King',
  'PAPA JOHNS': "Papa John's",
  // Subscriptions / Streaming
  'NETFLIX': 'Netflix', 'SPOTIFY': 'Spotify',
  'DISNEY PLUS': 'Disney+', 'DISNEYPLUS': 'Disney+', 'DISNEY+': 'Disney+',
  'NOW TV': 'Now TV', 'NOWTV': 'Now TV',
  'YOUTUBE PREMIUM': 'YouTube Premium', 'YOUTUBE': 'YouTube Premium',
  'APPLE.COM': 'Apple', 'APPLE': 'Apple',
  'MICROSOFT': 'Microsoft', 'GOOGLE': 'Google',
  // Telecoms
  'SKY': 'Sky', 'BT GROUP': 'BT', 'EE LIMITED': 'EE',
  'VODAFONE': 'Vodafone', 'O2': 'O2', 'THREE': 'Three Mobile',
  'VIRGIN MEDIA': 'Virgin Media',
  // Retail
  'PRIMARK': 'Primark', 'NEXT': 'Next', 'H&M': 'H&M', 'ZARA': 'Zara',
  'ASOS': 'ASOS', 'EBAY': 'eBay', 'ARGOS': 'Argos', 'CURRYS': 'Currys',
  'JOHN LEWIS': 'John Lewis', 'IKEA': 'IKEA', 'B&Q': 'B&Q', 'BOOHOO': 'Boohoo',
  // Fuel
  'BP': 'BP Fuel', 'SHELL': 'Shell Fuel', 'ESSO': 'Esso Fuel',
  'TEXACO': 'Texaco Fuel',
  // Finance & Transfers
  'PAYPAL': 'PayPal', 'MONZO': 'Monzo Transfer', 'STARLING': 'Starling Transfer',
  'REVOLUT': 'Revolut', 'WISE': 'Wise Transfer',
  // Health
  'BOOTS': 'Boots', 'SUPERDRUG': 'Superdrug',
  'HOLLAND AND BARRETT': 'Holland & Barrett', 'HOLLAND BARRETT': 'Holland & Barrett',
  // Charity
  'ISLAMIC RELIEF': 'Islamic Relief', 'MUSLIM AID': 'Muslim Aid',
  'PENNY APPEAL': 'Penny Appeal', 'HUMAN APPEAL': 'Human Appeal',
  'RED CROSS': 'Red Cross', 'OXFAM': 'Oxfam',
};

// Sorted longest-first so the most specific match wins
const MERCHANT_KEYS = Object.keys(MERCHANT_MAP).sort((a, b) => b.length - a.length);

function cleanMerchantName(desc) {
  if (!desc || desc === "Transaction") return desc;

  const stripped = desc
    .replace(/\*{2,}\s*\d{4}/g, "")          // **** 1234
    .replace(/\b\d{2}-\d{2}-\d{2}\b/g, "")   // sort codes
    .replace(/\b\d{8}\b/g, "")               // 8-digit account numbers
    .replace(/\b\d{6}\b/g, "")               // 6-digit references
    .replace(/\s+[A-Z0-9]{10,}$/i, "")       // trailing long ref strings
    .replace(/\s{2,}/g, " ")
    .trim();

  const upper = stripped.toUpperCase();
  for (const key of MERCHANT_KEYS) {
    if (upper.includes(key)) return MERCHANT_MAP[key];
  }

  // No map match: title-case and strip corporate suffixes
  const cleaned = stripped
    .replace(/\s+\b(Serv|Svcs?|Svc|Grp|Intl|Ltd|Plc|Inc|Corp|Co\.?|UK|GB)\b\.?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned
    ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
    : desc || "Transaction";
}

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
// STAGE 2 – Date patterns (including 2-digit year for HSBC)
// ---------------------------------------------------------------------------

const MON = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)`;

const DATE_PATTERN_SOURCES = [
  // DD MMM YYYY — most common UK
  [String.raw`\d{1,2}\s+` + MON + String.raw`\s+\d{4}`, "gi"],
  // MMM DD, YYYY — US format sometimes appears
  [MON + String.raw`\s+\d{1,2},?\s+\d{4}`, "gi"],
  // DD/MM/YYYY or DD-MM-YYYY
  [String.raw`\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}`, "g"],
  // DD MMM YY — HSBC 2-digit year (lower priority)
  [String.raw`\d{1,2}\s+` + MON + String.raw`\s+\d{2}`, "gi"],
  // DD MMM — no year (lowest priority)
  [String.raw`\d{1,2}\s+` + MON, "gi"],
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
// Date normalisation – always output DD/MM/YYYY
// ---------------------------------------------------------------------------

const MONTH_NUM = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normalizeDateStr(dateText) {
  if (!dateText) return dateText;
  const s = dateText.trim();

  // DD MMM YYYY  (e.g. "02 Apr 2024")
  const m1 = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (m1) {
    const mon = MONTH_NUM[m1[2].toLowerCase().slice(0, 3)];
    if (mon) return `${m1[1].padStart(2, "0")}/${mon}/${m1[3]}`;
  }

  // DD MMM YY  (HSBC, e.g. "02 Apr 24")
  const m2 = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2})$/);
  if (m2) {
    const mon = MONTH_NUM[m2[2].toLowerCase().slice(0, 3)];
    const yr  = parseInt(m2[3], 10) < 50 ? "20" + m2[3] : "19" + m2[3];
    if (mon) return `${m2[1].padStart(2, "0")}/${mon}/${yr}`;
  }

  // DD MMM  (no year, e.g. "02 Apr")
  const m3 = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})$/);
  if (m3) {
    const mon = MONTH_NUM[m3[2].toLowerCase().slice(0, 3)];
    if (mon) return `${m3[1].padStart(2, "0")}/${mon}/${new Date().getFullYear()}`;
  }

  // MMM DD, YYYY  (US, e.g. "Apr 02, 2024")
  const m4 = s.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m4) {
    const mon = MONTH_NUM[m4[1].toLowerCase().slice(0, 3)];
    if (mon) return `${m4[2].padStart(2, "0")}/${mon}/${m4[3]}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m5 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m5) return `${m5[1].padStart(2, "0")}/${m5[2].padStart(2, "0")}/${m5[3]}`;

  // YYYY-MM-DD (ISO)
  const m6 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m6) return `${m6[3].padStart(2, "0")}/${m6[2].padStart(2, "0")}/${m6[1]}`;

  return s; // return as-is if unrecognised
}

// Parse normalised DD/MM/YYYY back to a timestamp for comparison
function parseDateTs(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
}

// ---------------------------------------------------------------------------
// Bank detection
// ---------------------------------------------------------------------------

function detectBank(text) {
  const t = text.slice(0, 4000).toUpperCase(); // scan the header area only
  if (/BARCLAYS\s+BANK/.test(t) || /BARCLAYS\.CO\.UK/.test(t)) return "barclays";
  if (/HSBC\s+BANK/.test(t)    || /HSBC\.CO\.UK/.test(t) || /\bHSBC\b/.test(t)) return "hsbc";
  if (/LLOYDS\s+BANK/.test(t)  || /LLOYDS\.CO\.UK/.test(t)) return "lloyds";
  if (/NATWEST/.test(t)        || /NAT\s*WEST/.test(t)) return "natwest";
  if (/SANTANDER/.test(t)) return "santander";
  if (/MONZO\s+BANK/.test(t)   || /MONZO\.COM/.test(t)) return "monzo";
  if (/STARLING\s+BANK/.test(t)) return "starling";
  if (/HALIFAX/.test(t)) return "halifax";
  if (/NATIONWIDE/.test(t)) return "nationwide";
  return "generic";
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
// STAGE 4 – NatWest transaction type codes
// ---------------------------------------------------------------------------

// NatWest puts a type column (DD, CR, TFR, SO, BP, etc.) between date and description
const NATWEST_TYPE_RE = /^\s*(DD|CR|TFR|SO|BP|FP|ATM|INT|DIV|TXN|CHQ|DR)\s+/i;

function extractNatWestType(section) {
  const m = section.match(NATWEST_TYPE_RE);
  if (!m) return { code: null, rest: section };
  return { code: m[1].toUpperCase(), rest: section.slice(m[0].length) };
}

function natwestSuffix(code) {
  if (!code) return "";
  if (["CR", "INT", "DIV"].includes(code)) return "CR";
  if (["DD", "SO", "BP", "FP", "ATM", "CHQ", "DR"].includes(code)) return "DR";
  if (code === "TFR") return ""; // could be either direction
  return "";
}

// ---------------------------------------------------------------------------
// STAGE 4b – Income / expense / refund classification
// ---------------------------------------------------------------------------

const REFUND_KEYWORDS = [/refund\s+from/i, /\brefund\b/i];
const INCOME_KEYWORDS = [
  /received\s+from/i, /\bhmrc\b/i, /\bsalary\b/i, /\bwages\b/i,
  /faster\s+payment\s+received/i, /bacs\s+credit/i, /payment\s+from/i,
  /transfer\s+in/i, /money\s+in/i, /interest\s+paid/i,
];
const FORCE_EXPENSE = [/unpaid\s+direct\s+debit/i, /returned\s+direct\s+debit/i];

function classifyType(rawSection, suffix) {
  if (suffix === "DR") return "expense";
  for (const re of FORCE_EXPENSE) if (re.test(rawSection)) return "expense";
  if (suffix === "CR") return "income";
  for (const re of REFUND_KEYWORDS) if (re.test(rawSection)) return "refund";
  for (const re of INCOME_KEYWORDS) if (re.test(rawSection)) return "income";
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

  if (d.length > 60) d = d.slice(0, 60).replace(/\s+\S+$/, "").trim();
  return d || "Transaction";
}

// ---------------------------------------------------------------------------
// STAGE 5b – Category assignment
// ---------------------------------------------------------------------------

const CATEGORY_RULES = [
  {
    name: "Groceries",
    patterns: [
      /tesco/i, /sainsbury/i, /\basda\b/i, /\blidl\b/i, /\baldi\b/i,
      /morrisons/i, /waitrose/i, /\biceland\b/i, /marks\s*[&and]+\s*spencer/i,
      /\bm&s\b/i, /\bm\s+&\s+s\b/i, /co-?op\s+food/i, /farmfoods/i,
    ],
  },
  {
    name: "Shopping",
    patterns: [
      /\bamazon\b/i, /amznmktplace/i, /amzn/i, /\bebay\b/i, /\bargos\b/i,
      /\bikea\b/i, /\bprimark\b/i, /\bnext\b/i, /\basos\b/i, /\bboohoo\b/i,
      /very\.co/i, /\bcurry/i, /\bjohn\s+lewis\b/i, /\bzara\b/i, /\bh&m\b/i,
    ],
  },
  // Fast Food before Eating Out so specific chains match here
  {
    name: "Fast Food",
    patterns: [
      /nandos/i, /mcdonald/i, /\bkfc\b/i, /\bsubway\b/i, /burger\s*king/i,
      /\bgreggs/i, /\bpizza\b/i, /domino/i, /papa\s*john/i, /five\s+guys/i,
      /leon\s+restaurant/i,
    ],
  },
  {
    name: "Eating Out",
    patterns: [
      /restaurant/i, /\bcafe\b/i, /coffee/i, /deliveroo/i, /uber\s*eats/i,
      /just\s*eat/i, /dessert/i, /\bbistro\b/i, /pret\b/i, /costa\b/i,
      /starbucks/i, /caffe\s+nero/i, /wagamama/i,
    ],
  },
  {
    name: "Transport",
    patterns: [
      /\btfl\b/i, /transport\s+for\s+london/i, /\btrain\b/i, /\bbus\b/i,
      /parking/i, /petrol/i, /\bshell\b/i, /\bbp\b/i, /\besso\b/i,
      /national\s+rail/i, /trainline/i, /\blyft\b/i, /national\s+express/i,
      /\bgwr\b/i, /\blner\b/i, /avanti/i, /megabus/i, /bolt\s+/i,
    ],
  },
  {
    name: "Transport",
    patterns: [/\buber\b/i], // after Eating Out so "Uber Eats" stays there
  },
  {
    name: "Entertainment",
    patterns: [
      /netflix/i, /spotify/i, /disney/i, /cinema/i, /theatre/i,
      /\bsteam\b/i, /youtube\s+premium/i, /prime\s+video/i, /apple\s+tv/i,
      /ticketmaster/i, /sky\s+cinema/i, /\bxbox\b/i, /\bplaystation\b/i,
      /eventbrite/i, /now\s+tv/i,
    ],
  },
  {
    name: "Health & Beauty",
    patterns: [
      /pharmacy/i, /superdrug/i, /\bboots\b/i, /\bgym\b/i, /fitness/i,
      /holland\s+&?\s*barrett/i, /\bnhs\b/i, /dental/i, /optician/i,
      /\bspa\b/i, /\bsalon\b/i, /chemist/i,
    ],
  },
  {
    name: "Bills & Finance",
    patterns: [
      /direct\s+debit/i, /council\s+tax/i, /\bwater\b/i, /\bgas\b/i,
      /electric/i, /\bbarclays\b/i, /insurance/i, /broadband/i,
      /vodafone/i, /voda\b/i, /\bthree\b/i, /\bo2\b/i, /\bee\b/i,
      /\bsky\b/i, /virgin\s+media/i, /bill\s+payment/i, /standing\s+order/i,
      /council/i, /unpaid\s+dd/i, /microsoft/i,
    ],
  },
  {
    name: "ATM & Cash",
    patterns: [
      /\batm\b/i, /cash\s+machine/i, /\bwithdrawal\b/i, /atm\s+withdrawal/i,
      /cardtronics/i, /post\s+office\s+cash/i,
    ],
  },
  {
    name: "Charity & Donations",
    patterns: [
      /islamic\s+relief/i, /muslim\s+aid/i, /penny\s+appeal/i, /human\s+appeal/i,
      /red\s+cross/i, /\boxfam\b/i, /\bdonation\b/i, /\bcharity\b/i,
      /\bmuslim\b/i, /cancer\s+research/i, /save\s+the\s+children/i,
    ],
  },
  {
    name: "Transfers",
    patterns: [
      /\bmonzo\b/i, /\bpaypal\b/i, /bank\s+transfer/i, /\brevolut\b/i,
      /\bwise\b/i, /\bcash\s+app\b/i, /\bchaps\b/i, /\bstarling\b/i,
      /transfer\s+to/i, /transfer\s+from/i, /sent\s+to/i, /received\s+from/i,
    ],
  },
  {
    name: "Vaping & Tobacco",
    patterns: [/\bvape\b/i, /\bvapes\b/i, /vaping/i, /cloud\s+city/i, /\btobacco\b/i, /e-?cig/i],
  },
];

function categorize(rawSection, cleanedDescription, type) {
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
// STAGE 6 – Skip-line rules
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
// STAGE 7 – Transfer pairing detection
// ---------------------------------------------------------------------------

// After all transactions are parsed, flag pairs that look like internal transfers:
// same absolute amount, both categorised as Transfers, within 5 days of each other.
function detectTransferPairs(transactions) {
  // Group by amount
  const byAmount = {};
  transactions.forEach((t, i) => {
    const key = Math.abs(Number(t.amount)).toFixed(2);
    if (!byAmount[key]) byAmount[key] = [];
    byAmount[key].push(i);
  });

  const pairedIndices = new Set();

  for (const indices of Object.values(byAmount)) {
    if (indices.length < 2) continue;

    const credits = indices.filter((i) => transactions[i].amount > 0 && transactions[i].category === "Transfers");
    const debits  = indices.filter((i) => transactions[i].amount < 0 && transactions[i].category === "Transfers");

    for (const di of debits) {
      const dTs = parseDateTs(transactions[di].date);
      if (dTs === null) continue;
      for (const ci of credits) {
        if (pairedIndices.has(ci)) continue;
        const cTs = parseDateTs(transactions[ci].date);
        if (cTs === null) continue;
        if (Math.abs(cTs - dTs) <= 5 * 24 * 60 * 60 * 1000) {
          pairedIndices.add(di);
          pairedIndices.add(ci);
          break;
        }
      }
    }
  }

  return transactions.map((t, i) => ({
    ...t,
    isTransfer: t.category === "Transfers" || pairedIndices.has(i),
  }));
}

// ---------------------------------------------------------------------------
// PRIMARY PARSER
// ---------------------------------------------------------------------------

function primaryParse(text, bank) {
  const transactions = [];
  const dateMarkers = findAllDates(text);
  if (dateMarkers.length === 0) return transactions;

  for (let i = 0; i < dateMarkers.length; i++) {
    const { text: dateText, index, length } = dateMarkers[i];
    const sectionStart = index + length;
    const sectionEnd =
      i + 1 < dateMarkers.length ? dateMarkers[i + 1].index : text.length;
    const rawSection = text.slice(sectionStart, sectionEnd).trim();

    if (!rawSection || shouldSkip(dateText + " " + rawSection)) continue;

    const amounts = findAmounts(rawSection);
    if (amounts.length === 0) continue;

    // For NatWest, extract the type code for better classification
    let section = rawSection;
    let natwestCode = null;
    if (bank === "natwest") {
      const { code, rest } = extractNatWestType(rawSection);
      natwestCode = code;
      section = rest;
    }

    const txAmounts = amounts.length > 1 ? amounts.slice(0, -1) : amounts;

    for (const { value, index: amtIdx, suffix } of txAmounts) {
      const descRaw = section.slice(0, amtIdx).trim();
      if (shouldSkip(descRaw)) continue;

      const effectiveSuffix = natwestCode ? natwestSuffix(natwestCode) : suffix;
      const type = classifyType(descRaw, effectiveSuffix);
      const baseDesc = cleanDescription(descRaw);
      const description = cleanMerchantName(baseDesc);
      const category = categorize(descRaw, description, type);
      const amount = type === "expense" ? -Math.abs(value) : Math.abs(value);
      const date = normalizeDateStr(dateText);

      transactions.push({ date, description, amount, type, category });
    }
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// FALLBACK PARSER – any line containing date + amount
// ---------------------------------------------------------------------------

function fallbackParse(text, bank) {
  const transactions = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const unparsed = []; // lines with £ amounts that didn't parse (debug)

  for (const line of lines) {
    if (shouldSkip(line)) continue;
    const dateMatch = findFirstDate(line);

    // Log any line with a currency amount but no date (for missed tx detection)
    if (!dateMatch && /£[\d,]+\.\d{2}/.test(line)) {
      unparsed.push(line);
      continue;
    }
    if (!dateMatch) continue;

    const amounts = findAmounts(line);
    if (amounts.length === 0) continue;

    let section = line.replace(dateMatch.text, "").trim();
    let natwestCode = null;
    if (bank === "natwest") {
      const { code, rest } = extractNatWestType(section);
      natwestCode = code;
      section = rest;
    }

    const { value, suffix } = amounts[0];
    if (shouldSkip(section)) continue;

    const effectiveSuffix = natwestCode ? natwestSuffix(natwestCode) : suffix;
    const type = classifyType(section, effectiveSuffix);
    const baseDesc = cleanDescription(section);
    const description = cleanMerchantName(baseDesc);
    const category = categorize(section, description, type);
    const amount = type === "expense" ? -Math.abs(value) : Math.abs(value);
    const date = normalizeDateStr(dateMatch.text);

    transactions.push({ date, description, amount, type, category });
  }

  // Attempt to salvage multi-line descriptions that wrapped from previous line
  // by pairing consecutive unparsed lines that have an amount but no date
  // (already logged above – kept for future enhancement)

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
    const bank = detectBank(text);

    let transactions = primaryParse(text, bank);

    if (transactions.length < 3) {
      const fallback = fallbackParse(text, bank);
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

    // Flag transfers (categorised as Transfers or paired opposite transactions)
    const withTransferFlags = detectTransferPairs(transactions);

    return NextResponse.json({
      transactions: withTransferFlags,
      count: withTransferFlags.length,
      bank,
    });
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json(
      { error: "Failed to process the PDF: " + err.message },
      { status: 500 }
    );
  }
}
