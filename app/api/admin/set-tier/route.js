import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ADMIN_EMAIL = "kasimkhalid63@gmail.com";
const VALID_PLANS = ["FREE", "PRO", "BUSINESS"];

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, tier } = body;
  if (!email || !tier) {
    return NextResponse.json({ error: "email and tier are required" }, { status: 400 });
  }

  const plan = tier.toUpperCase();
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: `Invalid tier. Must be one of: ${VALID_PLANS.join(", ")}` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  await prisma.user.update({ where: { email }, data: { plan } });

  return NextResponse.json({ ok: true, email, plan });
}
