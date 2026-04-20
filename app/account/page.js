import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import AccountClient from "@/components/AccountClient";

export default async function AccountPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/account");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true, name: true, email: true, plan: true,
      uploadCount: true, image: true, createdAt: true,
    },
  });

  if (!user) redirect("/login?callbackUrl=/account");

  const params = await searchParams;
  const successMsg = params?.success === "true" ? "Your plan has been upgraded!" : null;
  const cancelMsg  = params?.canceled === "true" ? "Checkout was cancelled." : null;

  // Count statements
  let statementCount = 0;
  try {
    statementCount = await prisma.statement.count({ where: { userId: user.id } });
  } catch (_) {}

  return (
    <AccountClient
      user={user}
      successMsg={successMsg}
      cancelMsg={cancelMsg}
      statementCount={statementCount}
    />
  );
}
