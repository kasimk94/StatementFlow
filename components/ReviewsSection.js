"use client";
import { useState, useEffect } from "react";

function StarDisplay({ rating }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? "#fbbf24" : "#e2e8f0", fontSize: "1rem" }}>★</span>
      ))}
    </div>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

export default function ReviewsSection({ onScrollToUpload }) {
  const [reviews, setReviews] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdmin(params.get("admin") === "true");
    try {
      const stored = JSON.parse(localStorage.getItem("sf_reviews") || "[]");
      setReviews(stored);
    } catch {}
  }, []);

  function deleteReview(idx) {
    const updated = reviews.filter((_, i) => i !== idx);
    setReviews(updated);
    try { localStorage.setItem("sf_reviews", JSON.stringify(updated)); } catch {}
  }

  // Hide entirely when no reviews (admin still sees it)
  if (reviews.length === 0 && !isAdmin) return null;

  const shown = reviews.slice(0, 10);
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  return (
    <section id="reviews" className="py-24 px-6 bg-white border-t border-slate-100">
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-12 scroll-animate">
          <p style={{ color: "#2563eb", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            Reviews
          </p>
          <h2 className="text-4xl font-extrabold text-slate-900">What people are saying</h2>
          <p className="text-slate-500 mt-3 text-base">Real feedback from real users</p>

          {/* Rating badge */}
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginTop: 14, background: "#fefce8",
              border: "1px solid #fef08a", borderRadius: 999,
              padding: "7px 16px",
            }}
          >
            <span style={{ color: "#fbbf24", fontSize: "1rem" }}>⭐</span>
            <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>{avgRating}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
              ·{" "}
              {reviews.length > 0
                ? `Based on ${reviews.length} review${reviews.length !== 1 ? "s" : ""}`
                : "Based on early user feedback"}
            </span>
          </div>
        </div>

        {/* Admin panel */}
        {isAdmin && (
          <div
            style={{
              background: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: 12, padding: "16px 20px", marginBottom: 28,
            }}
          >
            <p style={{ fontWeight: 700, color: "#dc2626", fontSize: "0.85rem", marginBottom: reviews.length ? 10 : 0 }}>
              Admin panel — {reviews.length} review{reviews.length !== 1 ? "s" : ""} stored
            </p>
            {reviews.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 0",
                  borderTop: "1px solid #fecaca",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "0.8rem", color: "#374151" }}>
                    <strong>{r.name}</strong> — {r.rating}★ — {r.comment?.slice(0, 80) || "(no comment)"} —{" "}
                    <span style={{ color: "#94a3b8" }}>{formatDate(r.date)}</span>
                  </span>
                </div>
                <button
                  onClick={() => deleteReview(i)}
                  style={{
                    background: "#dc2626", border: "none", borderRadius: 6,
                    color: "#fff", padding: "3px 10px", fontSize: "0.75rem",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {shown.length === 0 && (
          <div
            style={{
              textAlign: "center", padding: "52px 24px",
              background: "#f8fafc", borderRadius: 16,
              border: "1px dashed #cbd5e1",
            }}
          >
            <div style={{ fontSize: "2.8rem", marginBottom: 12 }}>💬</div>
            <p style={{ fontWeight: 600, color: "#475569", fontSize: "1rem", marginBottom: 6 }}>
              No reviews yet — be the first!
            </p>
            <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginBottom: 22 }}>
              Upload your statement and share your experience.
            </p>
            <button
              onClick={onScrollToUpload}
              style={{
                background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 24px", fontWeight: 700, fontSize: "0.9rem",
                cursor: "pointer", boxShadow: "0 4px 14px rgba(108,92,231,0.3)",
              }}
            >
              Try it free →
            </button>
          </div>
        )}

        {/* Review cards */}
        {shown.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((review, i) => (
              <div
                key={i}
                className="anim-scale"
                style={{
                  background: "#fff",
                  border: "1px solid #e8e4f8",
                  borderRadius: 16,
                  padding: "20px",
                  boxShadow: "0 2px 12px rgba(108,92,231,0.06)",
                  transitionDelay: `${i * 0.08}s`,
                }}
              >
                <StarDisplay rating={review.rating} />
                {review.comment && (
                  <p style={{ color: "#475569", fontSize: "0.88rem", lineHeight: 1.65, margin: "12px 0 14px" }}>
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: review.comment ? 0 : 14 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", margin: 0 }}>
                      {review.name}
                    </p>
                    <p style={{ fontSize: "0.74rem", color: "#94a3b8", margin: "2px 0 0" }}>
                      {formatDate(review.date)}
                    </p>
                  </div>
                  <span
                    style={{
                      background: "#dcfce7", color: "#16a34a",
                      fontSize: "0.69rem", fontWeight: 700,
                      padding: "3px 9px", borderRadius: 999,
                      flexShrink: 0,
                    }}
                  >
                    ✓ Verified User
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
