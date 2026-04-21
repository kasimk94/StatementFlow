"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n ?? 0);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  // dateStr could be ISO or YYYY-MM-DD
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtUploadDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: "#0D1117",
      border: "1px solid rgba(201,168,76,0.1)",
      borderRadius: 16,
      padding: 24,
      height: 160,
      animation: "sf-pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StatementsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [statements, setStatements]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [viewingId, setViewingId]       = useState(null);
  const [hoverCard, setHoverCard]       = useState(null);
  const [hoverTrash, setHoverTrash]     = useState(null);

  // ── Fetch on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    fetch("/api/statements")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setStatements(data.statements ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, router]);

  // ── Delete handler ───────────────────────────────────────────────────────────
  async function handleDelete(id) {
    setDeleting(true);
    await fetch(`/api/statements/${id}`, { method: "DELETE" });
    setStatements((s) => s.filter((x) => x.id !== id));
    setDeleteConfirm(null);
    setDeleting(false);
  }

  // ── View Dashboard handler ───────────────────────────────────────────────────
  async function handleViewDashboard(id) {
    setViewingId(id);
    try {
      const res = await fetch(`/api/statements/${id}`);
      const data = await res.json();
      sessionStorage.setItem("sf_statement_data", JSON.stringify(data.statement.rawData));
      router.push("/");
    } finally {
      setViewingId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="My Statements">

      {/* Injected keyframe animation */}
      <style>{`
        @keyframes sf-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* Header row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 32,
      }}>
        {/* Left */}
        <div>
          <h1 style={{
            color: "#F5F0E8",
            fontSize: "1.8rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
          }}>
            My Statements
          </h1>
          <p style={{
            color: "#8A9BB5",
            fontSize: "1rem",
            marginTop: 4,
            margin: "4px 0 0",
          }}>
            Your complete upload history — always accessible
          </p>
        </div>

        {/* Right — Upload New button */}
        <Link
          href="/"
          style={{
            background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
            color: "#080C14",
            fontWeight: 700,
            fontSize: "0.875rem",
            padding: "10px 20px",
            borderRadius: 50,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(201,168,76,0.3)",
          }}
        >
          <svg
            width="18" height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17,8 12,3 7,8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload New Statement
        </Link>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))",
          gap: 16,
        }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && statements.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 80 }}>
          <svg
            width="64" height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C9A84C"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <path d="M12 18v-6"/>
            <path d="M9 15l3-3 3 3"/>
          </svg>
          <p style={{
            color: "#F5F0E8",
            fontSize: "1.2rem",
            fontWeight: 600,
            marginTop: 16,
          }}>
            No statements yet
          </p>
          <p style={{
            color: "#8A9BB5",
            fontSize: "0.95rem",
            marginTop: 6,
          }}>
            Upload your first bank statement to get started
          </p>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginTop: 24,
              background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
              color: "#080C14",
              fontWeight: 700,
              fontSize: "0.875rem",
              padding: "10px 24px",
              borderRadius: 50,
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(201,168,76,0.3)",
            }}
          >
            Upload Statement
          </Link>
        </div>
      )}

      {/* Statements grid */}
      {!loading && statements.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))",
          gap: 16,
        }}>
          {statements.map((stmt) => {
            const {
              id, bankName, dateFrom, dateTo,
              totalIn, totalOut, netBalance, transactionCount, createdAt,
            } = stmt;

            const isHovered = hoverCard === id;

            return (
              <div
                key={id}
                onMouseEnter={() => setHoverCard(id)}
                onMouseLeave={() => setHoverCard(null)}
                style={{
                  background: "#0D1117",
                  border: `1px solid ${isHovered ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.12)"}`,
                  borderRadius: 16,
                  padding: 24,
                  position: "relative",
                  transition: "border-color 0.15s ease",
                }}
              >
                {/* Top row: bank name + upload date */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}>
                  <span style={{
                    color: "#F5F0E8",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}>
                    {bankName || "Unknown Bank"}
                  </span>
                  <span style={{ color: "#8A9BB5", fontSize: "0.78rem" }}>
                    Uploaded {fmtUploadDate(createdAt)}
                  </span>
                </div>

                {/* Date range */}
                <div style={{ marginBottom: 16 }}>
                  <span style={{ color: "#8A9BB5", fontSize: "0.875rem" }}>
                    {dateFrom || dateTo
                      ? `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`
                      : "Statement dates not extracted"}
                  </span>
                </div>

                {/* Stats row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 8,
                  marginBottom: 16,
                }}>
                  {/* Money In */}
                  <div style={{
                    textAlign: "center",
                    background: "rgba(201,168,76,0.04)",
                    borderRadius: 8,
                    padding: 8,
                  }}>
                    <div style={{ color: "#00D4A0", fontSize: "0.95rem", fontWeight: 700 }}>
                      {fmt(totalIn)}
                    </div>
                    <div style={{ color: "#8A9BB5", fontSize: "0.7rem", marginTop: 2 }}>
                      Money In
                    </div>
                  </div>

                  {/* Money Out */}
                  <div style={{
                    textAlign: "center",
                    background: "rgba(201,168,76,0.04)",
                    borderRadius: 8,
                    padding: 8,
                  }}>
                    <div style={{ color: "#EF4444", fontSize: "0.95rem", fontWeight: 700 }}>
                      {fmt(totalOut)}
                    </div>
                    <div style={{ color: "#8A9BB5", fontSize: "0.7rem", marginTop: 2 }}>
                      Money Out
                    </div>
                  </div>

                  {/* Net */}
                  <div style={{
                    textAlign: "center",
                    background: "rgba(201,168,76,0.04)",
                    borderRadius: 8,
                    padding: 8,
                  }}>
                    <div style={{
                      color: (netBalance ?? 0) >= 0 ? "#00D4A0" : "#EF4444",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                    }}>
                      {fmt(netBalance)}
                    </div>
                    <div style={{ color: "#8A9BB5", fontSize: "0.7rem", marginTop: 2 }}>
                      Net
                    </div>
                  </div>

                  {/* Transactions */}
                  <div style={{
                    textAlign: "center",
                    background: "rgba(201,168,76,0.04)",
                    borderRadius: 8,
                    padding: 8,
                  }}>
                    <div style={{ color: "#C9A84C", fontSize: "0.95rem", fontWeight: 700 }}>
                      {transactionCount ?? 0}
                    </div>
                    <div style={{ color: "#8A9BB5", fontSize: "0.7rem", marginTop: 2 }}>
                      Transactions
                    </div>
                  </div>
                </div>

                {/* Bottom row: actions */}
                <div style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 4,
                }}>
                  {/* View Dashboard */}
                  <Link
                    href={`/dashboard?statementId=${id}`}
                    style={{
                      background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
                      color: "#080C14",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      padding: "8px 16px",
                      borderRadius: 8,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    View Dashboard
                  </Link>

                  {/* Download Excel (placeholder) */}
                  <button
                    onClick={() => alert("Coming soon")}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(201,168,76,0.3)",
                      color: "#C9A84C",
                      fontWeight: 600,
                      fontSize: "0.82rem",
                      padding: "8px 16px",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    Download Excel
                  </button>

                  {/* Trash button */}
                  <button
                    onClick={() => setDeleteConfirm(id)}
                    onMouseEnter={() => setHoverTrash(id)}
                    onMouseLeave={() => setHoverTrash(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: hoverTrash === id ? "#EF4444" : "#8A9BB5",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 6,
                      transition: "color 0.15s",
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                    }}
                    aria-label="Delete statement"
                  >
                    <svg
                      width="16" height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                      <path d="M10,11v6"/>
                      <path d="M14,11v6"/>
                      <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm !== null && (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0D1117",
              border: "1px solid rgba(201,168,76,0.2)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: "90%",
            }}
          >
            <p style={{
              color: "#F5F0E8",
              fontSize: "1.1rem",
              fontWeight: 700,
              marginBottom: 8,
              margin: "0 0 8px",
            }}>
              Delete statement?
            </p>
            <p style={{
              color: "#8A9BB5",
              fontSize: "0.875rem",
              marginBottom: 24,
              margin: "0 0 24px",
            }}>
              This cannot be undone. Your parsed data will be permanently deleted.
            </p>
            <div style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  background: "#1E2A3A",
                  color: "#F5F0E8",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                style={{
                  background: "#EF4444",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  cursor: deleting ? "default" : "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
