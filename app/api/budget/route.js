import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const budget = await prisma.budget.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ budget });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { monthlyIncome, categories } = await req.json();
  const budget = await prisma.budget.upsert({
    where: { userId: session.user.id },
    update: { monthlyIncome: monthlyIncome ?? null, categories: categories ?? {} },
    create: { userId: session.user.id, monthlyIncome: monthlyIncome ?? null, categories: categories ?? {} },
  });
  return NextResponse.json({ budget });
}
