import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ADMIN_EMAIL = "kasimkhalid63@gmail.com";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now   = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalStatements,
    statementsThisMonth,
    paidSubscribers,
    last30Statements,
    last30Users,
    recentUsers,
    recentStatements,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.statement.count(),
    prisma.statement.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { plan: { in: ["PRO", "BUSINESS"] } } }),
    prisma.statement.findMany({
      where:   { createdAt: { gte: start } },
      select:  { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where:   { createdAt: { gte: start } },
      select:  { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      take:    20,
      orderBy: { createdAt: "desc" },
      select:  { id: true, name: true, email: true, plan: true, createdAt: true, uploadCount: true },
    }),
    prisma.statement.findMany({
      take:    20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, bankName: true, dateFrom: true, dateTo: true,
        transactionCount: true, createdAt: true,
        rawData: false,
        user: { select: { email: true } },
      },
    }),
  ]);

  // Build daily arrays for last 30 days
  function buildDailyMap(records) {
    const map = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      map[key] = 0;
    }
    for (const r of records) {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      if (key in map) map[key]++;
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }

  const dailyUploads  = buildDailyMap(last30Statements);
  const dailySignups  = buildDailyMap(last30Users);

  // Attach confidence from rawData for recentStatements
  const recentStatementsWithMeta = await prisma.statement.findMany({
    take:    20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, bankName: true, dateFrom: true, dateTo: true,
      transactionCount: true, createdAt: true,
      rawData: true,
      user: { select: { email: true } },
    },
  });

  const recentStatementsClean = recentStatementsWithMeta.map(s => ({
    id:               s.id,
    bankName:         s.bankName,
    dateFrom:         s.dateFrom,
    dateTo:           s.dateTo,
    transactionCount: s.transactionCount,
    createdAt:        s.createdAt,
    userEmail:        s.user?.email ?? "—",
    confidence:       s.rawData?.confidence ?? null,
  }));

  return NextResponse.json({
    totalUsers,
    totalStatements,
    statementsThisMonth,
    paidSubscribers,
    dailyUploads,
    dailySignups,
    recentUsers,
    recentStatements: recentStatementsClean,
  });
}
