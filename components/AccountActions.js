"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function SignOutButton() {
  return (
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
  );
}

export function UpgradeButtons() {
  const [loading, setLoading] = useState(null);

  async function handleUpgrade(plan) {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 16 }}>
        Upgrade your plan
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {/* Pro */}
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "2px solid #6c5ce7", boxShadow: "0 4px 20px rgba(108,92,231,0.12)" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#6c5ce7", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Pro</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>
            £4.99<span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#64748b" }}>/mo</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {["Unlimited uploads", "Excel export", "Spending dashboard", "Email support"].map((f) => (
              <li key={f} style={{ fontSize: "0.875rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6c5ce7", fontWeight: 700 }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("PRO")}
            disabled={loading === "PRO"}
            style={{
              width: "100%", padding: 12, borderRadius: 10, border: "none",
              background: loading === "PRO" ? "#a5b4fc" : "linear-gradient(135deg, #6d28d9, #4f46e5)",
              color: "white", fontWeight: 700, fontSize: "0.95rem",
              cursor: loading === "PRO" ? "not-allowed" : "pointer",
            }}
          >
            {loading === "PRO" ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </div>

        {/* Business */}
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1.5px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0ea5e9", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Business</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1a1a2e", marginBottom: 4 }}>
            £19.99<span style={{ fontSize: "0.9rem", fontWeight: 500, color: "#64748b" }}>/mo</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {["Everything in Pro", "Multi-statement upload", "VAT analysis", "Priority support"].map((f) => (
              <li key={f} style={{ fontSize: "0.875rem", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#0ea5e9", fontWeight: 700 }}>✓</span> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleUpgrade("BUSINESS")}
            disabled={loading === "BUSINESS"}
            style={{
              width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #0ea5e9",
              background: "transparent", color: "#0ea5e9", fontWeight: 700, fontSize: "0.95rem",
              cursor: loading === "BUSINESS" ? "not-allowed" : "pointer",
            }}
          >
            {loading === "BUSINESS" ? "Redirecting…" : "Upgrade to Business"}
          </button>
        </div>
      </div>
    </div>
  );
}
