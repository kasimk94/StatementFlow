"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n ?? 0);
}

function hasUploadedThisMonth(statements) {
  const now = new Date();
  return (statements || []).some(s => {
    const d = new Date(s.createdAt);
    return !isNaN(d) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

// ── Inline upload zone ────────────────────────────────────────────────────────

function InlineUpload() {
  const router = useRouter();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(f) {
    if (!f || f.type !== 'application/pdf') { setError('PDF files only'); return; }
    setFile(f);
    setError(null);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/convert', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Upload failed');
      setDone(true);
      setTimeout(() => router.push(`/dashboard?statementId=${json.statementId}`), 1000);
    } catch (e) {
      setError(e.message);
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        border: `2px dashed ${dragOver ? 'rgba(201,168,76,0.7)' : 'rgba(201,168,76,0.35)'}`,
        borderRadius: 16, padding: '18px 24px', marginBottom: 24,
        background: dragOver ? 'rgba(201,168,76,0.04)' : 'transparent',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >
      {/* Left: icon + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        </svg>
        <div>
          {done ? (
            <span style={{ color: '#10B981', fontSize: '0.875rem', fontWeight: 600 }}>
              ✅ Done! Taking you to your dashboard...
            </span>
          ) : file ? (
            <span style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 600 }}>{file.name}</span>
          ) : (
            <span style={{ color: '#8A9BB5', fontSize: '0.875rem' }}>
              Drop your PDF here or <span style={{ color: '#C9A84C', fontWeight: 600 }}>browse</span>
            </span>
          )}
          {error && <p style={{ margin: '2px 0 0', color: '#EF4444', fontSize: '0.78rem' }}>{error}</p>}
        </div>
      </div>

      {/* Right: action button */}
      {!done && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!file && (
            <>
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files[0])} />
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  padding: '8px 20px', borderRadius: 50,
                  background: 'linear-gradient(135deg,#C9A84C,#E8C97A)',
                  color: '#080C14', fontWeight: 700, fontSize: '0.85rem',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Browse Files
              </button>
            </>
          )}
          {file && !uploading && (
            <>
              <button
                onClick={() => { setFile(null); setError(null); }}
                style={{ background: 'transparent', border: 'none', color: '#8A9BB5', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Clear
              </button>
              <button
                onClick={handleUpload}
                style={{
                  padding: '8px 20px', borderRadius: 50,
                  background: 'linear-gradient(135deg,#C9A84C,#E8C97A)',
                  color: '#080C14', fontWeight: 700, fontSize: '0.85rem',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Analyse Statement
              </button>
            </>
          )}
          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C9A84C', fontSize: '0.85rem', fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: 'sf-spin 1s linear infinite', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Analysing...
            </div>
          )}
        </div>
      )}
    </div>
  );
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
        @keyframes sf-spin { to { transform: rotate(360deg); } }
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
          href="/upload"
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

      {/* Inline upload zone */}
      {status === 'authenticated' && <InlineUpload />}

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

      {/* Locked state for free users */}
      {!loading && (session?.user?.plan || 'FREE') === 'FREE' && (
        <div style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 style={{ color: '#F5F0E8', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Statement history is a Pro feature
          </h2>
          <p style={{ color: '#8A9BB5', fontSize: '0.9rem', maxWidth: 360, lineHeight: 1.6, margin: '0 0 32px' }}>
            Upgrade to Pro to save your statements, revisit past data, and track your finances over time.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <form action="/api/stripe/checkout" method="POST">
              <input type="hidden" name="plan" value="PRO" />
              <button type="submit" style={{
                padding: '11px 28px',
                background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
                color: '#080C14', fontWeight: 700, fontSize: '0.9rem',
                borderRadius: 50, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(201,168,76,0.35)',
              }}>
                Upgrade to Pro — £4.99/mo
              </button>
            </form>
            <Link href="/upload" style={{
              padding: '11px 24px',
              background: 'transparent', border: '1px solid rgba(201,168,76,0.35)',
              color: '#C9A84C', fontWeight: 600, fontSize: '0.875rem',
              borderRadius: 50, textDecoration: 'none',
            }}>
              Upload a Statement
            </Link>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && statements.length === 0 && (session?.user?.plan || 'FREE') !== 'FREE' && (
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
            href="/upload"
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

      {/* Monthly reminder card */}
      {!loading && (session?.user?.plan || 'FREE') !== 'FREE' && statements.length > 0 && !hasUploadedThisMonth(statements) && (() => {
        const monthName = MONTH_NAMES[new Date().getMonth()];
        return (
          <div style={{
            background: 'rgba(201,168,76,0.06)',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, marginBottom: 20,
          }}>
            <div>
              <p style={{ margin: '0 0 3px', color: '#F5F0E8', fontSize: '0.9rem', fontWeight: 700 }}>
                📅 Upload {monthName} statement
              </p>
              <p style={{ margin: 0, color: '#8A9BB5', fontSize: '0.82rem' }}>
                Keep your financial picture current — upload your {monthName} statement
              </p>
            </div>
            <Link href="/upload" style={{
              background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14',
              fontWeight: 700, fontSize: '0.82rem', padding: '9px 18px',
              borderRadius: 50, textDecoration: 'none', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(201,168,76,0.3)',
            }}>
              Upload Now
            </Link>
          </div>
        );
      })()}

      {/* Statements grid */}
      {!loading && statements.length > 0 && (session?.user?.plan || 'FREE') !== 'FREE' && (
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
