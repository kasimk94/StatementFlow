import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { SignOutButton, UpgradeButtons } from "@/components/AccountActions";

const PLAN_DETAILS = {
  FREE:     { label: "Free",     color: "#64748b", uploads: "3 / month", price: "£0" },
  PRO:      { label: "Pro",      color: "#6c5ce7", uploads: "Unlimited", price: "£7.99/mo" },
  BUSINESS: { label: "Business", color: "#0ea5e9", uploads: "Unlimited", price: "£25.99/mo" },
};

function PlanBadge({ plan }) {
  const d = PLAN_DETAILS[plan] || PLAN_DETAILS.FREE;
  return (
    <span style={{
      background: d.color + "18", color: d.color,
      border: `1.5px solid ${d.color}33`, borderRadius: 999,
      padding: "3px 12px", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.04em",
    }}>
      {d.label}
    </span>
  );
}

export default async function AccountPage({ searchParams }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true, plan: true, uploadCount: true, createdAt: true },
  });

  if (!user) {
    redirect("/login?callbackUrl=/account");
  }

  const plan = user.plan || "FREE";
  const planDetails = PLAN_DETAILS[plan] || PLAN_DETAILS.FREE;
  const params = await searchParams;
  const successMsg = params?.success === "true" ? "Your plan has been upgraded!" : null;
  const cancelMsg  = params?.canceled === "true" ? "Checkout was cancelled." : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f8f7ff 0%, #ede9fe 100%)",
      padding: "60px 16px 40px",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", color: "#6c5ce7", fontSize: "0.875rem", fontWeight: 600 }}>
            ← Back to home
          </Link>
          <SignOutButton />
        </div>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>My Account</h1>
        <p style={{ color: "#64748b", marginBottom: 32 }}>{user.email}</p>

        {successMsg && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#16a34a", fontSize: "0.875rem" }}>
            {successMsg}
          </div>
        )}
        {cancelMsg && (
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#854d0e", fontSize: "0.875rem" }}>
            {cancelMsg}
          </div>
        )}

        {/* Current plan card */}
        <div style={{
          background: "white", borderRadius: 20, padding: "28px",
          boxShadow: "0 4px 24px rgba(108,92,231,0.08)",
          border: "1px solid rgba(108,92,231,0.1)", marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                Current Plan
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1a1a2e" }}>{planDetails.label}</span>
                <PlanBadge plan={plan} />
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e" }}>{planDetails.price}</p>
              <p style={{ fontSize: "0.8rem", color: "#64748b" }}>{planDetails.uploads} uploads</p>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Uploads used: <strong style={{ color: "#1a1a2e" }}>{user.uploadCount ?? 0}</strong>
              {plan === "FREE" && <span style={{ color: "#94a3b8" }}> / 3</span>}
            </p>
          </div>
        </div>

        {/* Upgrade or manage */}
        {plan === "FREE" ? (
          <UpgradeButtons />
        ) : (
          <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              To manage or cancel your subscription, contact us at{" "}
              <a href="mailto:hello@statementflow.app" style={{ color: "#6c5ce7", fontWeight: 600 }}>
                hello@statementflow.app
              </a>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
