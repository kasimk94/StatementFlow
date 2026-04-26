import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const GROCERY_RE   = /tesco|sainsbury|asda|morrisons|lidl|aldi|waitrose|co-op|co op|iceland|marks.{0,3}spencer|m&s food/i;
const CASH_RE      = /\bcash\b|atm|cashpoint|cash machine|cardtronics|post office|withdrawal/i;
const SKIP_CATS    = new Set(["Transfers Received","Transfers Sent","Internal Transfer","Refunds","Cash & ATM"]);
const KNOWN_NAMES  = new Set([
  "kasam","kasim","mohammed","mohammad","ahmed","ali","khan","john","james","david",
  "robert","michael","william","sarah","emma","emily","jessica","laura","sophie",
  "smith","jones","taylor","brown","wilson","johnson","williams","davies","evans",
]);

function normKey(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

function looksLikePerson(name) {
  if (!name) return false;
  if (/^(mr\.?\s|mrs\.?\s|ms\.?\s|miss\.?\s|dr\.?\s)/i.test(name)) return true;
  const s = name.replace(/\s+\d{4,}\s*$/, "").trim();
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 4 || /\d/.test(s)) return false;
  if (!words.every(w => /^[A-Z][a-zA-Z]{1,}$/.test(w))) return false;
  if (KNOWN_NAMES.has(words[0].toLowerCase())) return true;
  if (KNOWN_NAMES.has(words[words.length - 1].toLowerCase())) return true;
  if (words.length === 2 && words.every(w => w.length >= 3 && w.length <= 12)) return true;
  return false;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statements = await prisma.statement.findMany({
    where:   { userId: session.user.id },
    orderBy: { dateFrom: "asc" },
    select:  { id: true, dateFrom: true, dateTo: true, rawData: true },
  });

  if (statements.length < 2) {
    return NextResponse.json({ subscriptions: [], statementCount: statements.length });
  }

  // merchantKey → { displayName, periods: { periodKey → firstAmount } }
  const merchantMap = {};

  for (const stmt of statements) {
    const txs = stmt.rawData?.transactions || [];
    const periodKey = stmt.dateFrom || stmt.id;

    for (const tx of txs) {
      if (!tx.amount || tx.amount >= 0) continue;
      const amount = Math.abs(tx.amount);
      if (amount < 3) continue;
      if (GROCERY_RE.test(tx.description)) continue;
      if (CASH_RE.test(tx.description)) continue;
      if (tx.isInternal) continue;
      if (SKIP_CATS.has(tx.category)) continue;
      if (looksLikePerson(tx.description)) continue;

      const key = normKey(tx.description);
      if (!key || key.length < 3) continue;

      if (!merchantMap[key]) {
        merchantMap[key] = { displayName: tx.description, periods: {} };
      }
      // Keep first occurrence per period
      if (!merchantMap[key].periods[periodKey]) {
        merchantMap[key].periods[periodKey] = amount;
      }
    }
  }

  const subscriptions = [];

  for (const data of Object.values(merchantMap)) {
    const amounts = Object.values(data.periods);
    if (amounts.length < 2) continue;

    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const variance = avg > 0 ? (max - min) / avg : 1;

    // Allow up to 15% variance — tighter than flat "within £1" for variable bills
    if (variance > 0.15) continue;

    const name = data.displayName;
    let category = "Subscription";
    if (/insurance|mortgage|loan|finance|credit|council|tax|energy|electricity|gas|water|broadband|mobile|phone|contract|rent/i.test(name)) {
      category = "Bill";
    } else if (/direct.?debit|standing.?order/i.test(name)) {
      category = "Direct Debit";
    }

    subscriptions.push({
      merchantName:   name,
      averageAmount:  parseFloat(avg.toFixed(2)),
      monthsDetected: amounts.length,
      category,
    });
  }

  subscriptions.sort((a, b) =>
    b.monthsDetected - a.monthsDetected || b.averageAmount - a.averageAmount
  );

  return NextResponse.json({
    subscriptions: subscriptions.slice(0, 20),
    statementCount: statements.length,
  });
}
