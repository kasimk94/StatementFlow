"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

const PLAN_DETAILS = {
  FREE:     { label: "FREE",     price: "£0/month",     uploads: "1 upload per month" },
  PRO:      { label: "PRO",      price: "£4.99/month",  uploads: "Unlimited uploads" },
  BUSINESS: { label: "BUSINESS", price: "£19.99/month", uploads: "Unlimited uploads" },
};

function PlanBadge({ plan }) {
  const styles = {
    FREE:     { background: "#1E2A3A", color: "#8A9BB5" },
    PRO:      { background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#080C14" },
    BUSINESS: { background: "linear-gradient(135deg, #818CF8, #6366f1)", color: "#fff" },
  };
  const s = styles[plan] || styles.FREE;
  return (
    <span style={{
      ...s,
      padding: "3px 12px", borderRadius: 999, fontSize: "0.72rem",
      fontWeight: 700, letterSpacing: "0.06em",
    }}>
      {plan}
    </span>
  );
}

function Section({ children, style }) {
  return (
    <div style={{
      background: "#0D1117",
      border: "1px solid rgba(201,168,76,0.12)",
      borderRadius: 16,
      padding: 28,
      marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: "0.72rem", fontWeight: 600, color: "#8A9BB5",
      letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16,
    }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(201,168,76,0.08)", margin: "20px 0" }} />;
}

export default function AccountClient({ user, successMsg, cancelMsg, statementCount }) {
  const plan = user.plan || "FREE";
  const planDetails = PLAN_DETAILS[plan] || PLAN_DETAILS.FREE;
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const initials = (user.name || user.email || "?")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const uploadLimit = plan === "FREE" ? 1 : null;

  return (
    <DashboardLayout title="Account">
      <div style={{ maxWidth: 680 }}>

        {/* Alerts */}
        {successMsg && (
          <div style={{
            background: "rgba(0,212,160,0.08)", border: "1px solid rgba(0,212,160,0.25)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            color: "#00D4A0", fontSize: "0.875rem",
          }}>
            {successMsg}
          </div>
        )}
        {cancelMsg && (
          <div style={{
            background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            color: "#C9A84C", fontSize: "0.875rem",
          }}>
            {cancelMsg}
          </div>
        )}

        {/* Profile */}
        <Section>
          <SectionLabel>Profile</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {user.image ? (
              <img src={user.image} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.1rem", fontWeight: 700, color: "#080C14",
              }}>
                {initials}
              </div>
            )}
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#F5F0E8", marginBottom: 4 }}>
                {user.name || "—"}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#8A9BB5" }}>{user.email}</div>
              {user.image && (
                <span style={{
                  display: "inline-block", marginTop: 6,
                  background: "rgba(66,133,244,0.1)", color: "#4285F4",
                  border: "1px solid rgba(66,133,244,0.2)", borderRadius: 99,
                  padding: "2px 10px", fontSize: "0.72rem", fontWeight: 600,
                }}>
                  Signed in with Google
                </span>
              )}
            </div>
          </div>
        </Section>

        {/* Plan */}
        <Section id="upgrade">
          <SectionLabel>Plan</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#F5F0E8" }}>
                  {planDetails.label}
                </span>
                <PlanBadge plan={plan} />
              </div>
              <span style={{ fontSize: "0.875rem", color: "#8A9BB5" }}>{planDetails.price} · {planDetails.uploads}</span>
            </div>
            {plan !== "FREE" && (
              <span style={{
                background: "rgba(0,212,160,0.1)", color: "#00D4A0",
                border: "1px solid rgba(0,212,160,0.25)", borderRadius: 99,
                padding: "4px 14px", fontSize: "0.78rem", fontWeight: 600,
              }}>
                Active
              </span>
            )}
          </div>

          {plan === "FREE" && (
            <>
              <Divider />
              <p style={{ fontSize: "0.875rem", color: "#8A9BB5", marginBottom: 16 }}>
                Upgrade to unlock unlimited uploads, full statement history, and priority support.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <form action="/api/stripe/checkout" method="POST" style={{ display: "inline" }}>
                  <input type="hidden" name="plan" value="PRO" />
                  <button type="submit" style={{
                    background: "linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)",
                    color: "#080C14", fontWeight: 700, fontSize: "0.9rem",
                    padding: "11px 24px", borderRadius: 50, border: "none",
                    cursor: "pointer", boxShadow: "0 4px 20px rgba(201,168,76,0.35)",
                  }}>
                    Upgrade to Pro — £4.99/mo
                  </button>
                </form>
                <form action="/api/stripe/checkout" method="POST" style={{ display: "inline" }}>
                  <input type="hidden" name="plan" value="BUSINESS" />
                  <button type="submit" style={{
                    background: "rgba(129,140,248,0.1)", color: "#818CF8",
                    border: "1px solid rgba(129,140,248,0.3)", fontWeight: 600,
                    fontSize: "0.9rem", padding: "11px 24px", borderRadius: 50, cursor: "pointer",
                  }}>
                    Business — £19.99/mo
                  </button>
                </form>
              </div>
            </>
          )}

          {plan !== "FREE" && (
            <>
              <Divider />
              <p style={{ fontSize: "0.875rem", color: "#8A9BB5" }}>
                To manage or cancel your subscription, email{" "}
                <a href="mailto:hello@statementflow.app" style={{ color: "#C9A84C", fontWeight: 600, textDecoration: "none" }}>
                  hello@statementflow.app
                </a>
              </p>
            </>
          )}
        </Section>

        {/* Usage */}
        <Section>
          <SectionLabel>Usage</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.875rem", color: "#8A9BB5" }}>Statements this month</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#F5F0E8" }}>
                  {user.uploadCount ?? 0}{uploadLimit ? ` / ${uploadLimit}` : ""}
                </span>
              </div>
              {uploadLimit && (
                <div style={{ height: 4, background: "#1E2A3A", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(((user.uploadCount ?? 0) / uploadLimit) * 100, 100)}%`,
                    background: "linear-gradient(90deg, #C9A84C, #E8C97A)",
                    borderRadius: 999,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.875rem", color: "#8A9BB5" }}>Total statements saved</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#C9A84C" }}>{statementCount}</span>
            </div>
          </div>
        </Section>

        {/* Danger zone */}
        <Section>
          <SectionLabel>Account</SectionLabel>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{
                background: "transparent", color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10,
                padding: "10px 20px", fontSize: "0.875rem", fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
            >
              Sign out
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                background: "transparent", color: "#8A9BB5", border: "none",
                fontSize: "0.8rem", cursor: "pointer", padding: "10px 4px",
                textDecoration: "underline",
              }}
            >
              Delete account
            </button>
          </div>
        </Section>

      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(4px)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#0D1117", border: "1px solid rgba(201,168,76,0.2)",
            borderRadius: 16, padding: 32, maxWidth: 400, width: "90%",
          }}>
            <h2 style={{ color: "#F5F0E8", fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>
              Delete account?
            </h2>
            <p style={{ color: "#8A9BB5", fontSize: "0.875rem", marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently delete your account, all saved statements, and cannot be undone.
              Please email <a href="mailto:hello@statementflow.app" style={{ color: "#C9A84C" }}>hello@statementflow.app</a> to delete your account.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirm(false)}
                style={{
                  background: "#1E2A3A", color: "#F5F0E8", border: "none",
                  padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
