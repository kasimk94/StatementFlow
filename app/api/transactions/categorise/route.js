import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { merchantKey, newCategory } = await req.json();

    if (!merchantKey || !newCategory) {
      return NextResponse.json({ error: "merchantKey and newCategory are required" }, { status: 400 });
    }

    await prisma.merchantCategory.upsert({
      where: {
        userId_merchantKey: {
          userId: session.user.id,
          merchantKey,
        },
      },
      update: {
        category: newCategory,
        count: { increment: 1 },
      },
      create: {
        userId: session.user.id,
        merchantKey,
        category: newCategory,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Categorise error:", err.message);
    return NextResponse.json({ error: "Unexpected error: " + err.message }, { status: 500 });
  }
}
