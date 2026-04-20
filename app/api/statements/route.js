import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statements = await prisma.statement.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      bankName: true,
      dateFrom: true,
      dateTo: true,
      totalIn: true,
      totalOut: true,
      netBalance: true,
      transactionCount: true,
      createdAt: true,
      // Do NOT include rawData in the list — too large
    },
  });

  return NextResponse.json({ statements });
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Verify ownership before deleting
  const stmt = await prisma.statement.findUnique({ where: { id }, select: { userId: true } });
  if (!stmt || stmt.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.statement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
