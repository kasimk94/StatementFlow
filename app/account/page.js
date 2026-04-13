"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";

const PLAN_DETAILS = {
  FREE:     { label: "Free",     color: "#64748b", uploads: "3 / month",    price: "£0" },
  PRO:      { label: "Pro",      color: "#6c5ce7", uploads: "Unlimited",    price: "£7.99/mo" },
  BUSINESS: { label: "Business", color: "#0ea5e9", uploads: "Unlimited",    price: "£25.99/mo" },
};

function PlanBadge({ plan }) {
  const d = PLAN_DETAILS[plan] || PLAN_DETAILS.FREE;
  return (
    <span style={{
      background: d.color + "18",
      color: d.color,
      border: `1.5px solid ${d.color}33`,
      borderRadius: 999,
      padding: "3px 12px",
      fontSize: "0.8rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
    }}>
      {d.label}
    </span>
  );
}

function AccountPageInner() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userData,      setUserData]      = useState(null);
  const [loadingData,   setLoadingData]   = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState(null);
  const [successMsg,    setSuccessMsg]    = useState("");
  const [cancelMsg,     setCancelMsg]     = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/account");
    }
  }, [status, router]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setSuccessMsg("Your plan has been upgraded!");
      update(); // refresh session
    }
    if (searchParams.get("canceled") === "true") {
      setCancelMsg("Checkout was cancelled.");
    }
  }, [searchParams, update]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/account/me")
      .then((r) => r.json())
      .then((d) => { setUserData(d); setLoadingData(false); })
      .catch(() => setLoadingData(false));
  }, [session]);

  async function handleUpgrade(plan) {
    setUpgradingPlan(plan);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    setUpgradingPlan(null);
    if (data.url) {
      window.location.href = data.url;
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#6c5ce7", fontSize: "1rem" }}>Loading…</div>
      </div>
    );
  }

  const plan = userData?.plan || session?.user?.plan || "FREE";
  const planDetails = PLAN_DETAILS[plan] || PLAN_DETAILS.FREE;

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
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            style={{
              background: "transparent", border: "1.5px solid #e2e8f0",
              borderRadius: 8, padding: "6px 14px", fontSize: "0.85rem",
              color: "#64748b", cursor: "pointer", fontWeight: 500,
            }}
          >
            Sign out
          </button>
        </div>

        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>My Account</h1>
        <p style={{ color: "#64748b", marginBottom: 32 }}>{session.user?.email}</p>

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
          background: "white", borderRadius: 20, padding: "28px 28px",
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

          {!loadingData && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
              <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                Uploads used: <strong style={{ color: "#1a1a2e" }}>{userData?.uploadCount ?? 0}</strong>
                {plan === "FREE" && <span style={{ color: "#94a3b8" }}> / 3</span>}
              </p>
            </div>
          )}
        </div>

        {/* Upgrade options */}
        {plan === "FREE" && (
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 16 }}>Upgrade your plan</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {/* Pro */}
              <div style={{
                background: "white", borderRadius: 16, padding: "24px",
                border: "2px solid #6c5ce7",
                boxShadow: "0 4px 20px rgba(108,92,231,0.12)",
              }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#6c5ce7", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Pro</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>£7.99<span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#64748b" }}>/mo</span></div>
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Unlimited uploads", "Excel export", "Spending dashboard", "Email support"].map((f) => (
                    <li key={f} style={{ fontSize: "0.875rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#6c5ce7", fontWeight: 700 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade("PRO")}
                  disabled={upgradingPlan === "PRO"}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, border: "none",
                    background: upgradingPlan === "PRO" ? "#a5b4fc" : "linear-gradient(135deg, #6d28d9, #4f46e5)",
                    color: "white", fontWeight: 700, fontSize: "0.95rem",
                    cursor: upgradingPlan === "PRO" ? "not-allowed" : "pointer",
                  }}
                >
                  {upgradingPlan === "PRO" ? "Redirecting…" : "Upgrade to Pro"}
                </button>
              </div>

              {/* Business */}
              <div style={{
                background: "white", borderRadius: 16, padding: "24px",
                border: "1.5px solid #e2e8f0",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0ea5e9", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Business</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>£25.99<span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#64748b" }}>/mo</span></div>
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  {["Everything in Pro", "Multi-statement upload", "VAT analysis", "Priority support"].map((f) => (
                    <li key={f} style={{ fontSize: "0.875rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#0ea5e9", fontWeight: 700 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade("BUSINESS")}
                  disabled={upgradingPlan === "BUSINESS"}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #0ea5e9",
                    background: "transparent", color: "#0ea5e9", fontWeight: 700, fontSize: "0.95rem",
                    cursor: upgradingPlan === "BUSINESS" ? "not-allowed" : "pointer",
                  }}
                >
                  {upgradingPlan === "BUSINESS" ? "Redirecting…" : "Upgrade to Business"}
                </button>
              </div>
            </div>
          </div>
        )}

        {plan !== "FREE" && (
          <div style={{
            background: "white", borderRadius: 16, padding: "20px 24px",
            border: "1px solid #e2e8f0", marginTop: 8,
          }}>
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

export default function AccountPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#6c5ce7" }}>Loading…</span></div>}>
      <AccountPageInner />
    </Suspense>
  );
}
