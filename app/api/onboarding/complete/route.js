import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { banks } = await req.json();
  if (!Array.isArray(banks)) {
    return NextResponse.json({ error: "Invalid banks" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { banks },
  });

  return NextResponse.json({ ok: true });
}
