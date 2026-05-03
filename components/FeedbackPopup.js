"use client";
import { useState, useEffect } from "react";

export default function FeedbackPopup({ onClose }) {
  const [rating,    setRating]    = useState(0);
  const [hovered,   setHovered]   = useState(0);
  const [comment,   setComment]   = useState("");
  const [name,      setName]      = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [visible,   setVisible]   = useState(false);

  // Slide in after mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 350);
  }

  function handleSubmit() {
    if (rating === 0) return;
    const review = {
      name:    name.trim() || "Anonymous",
      rating,
      comment: comment.trim(),
      date:    new Date().toISOString(),
    };
    try {
      const existing = JSON.parse(localStorage.getItem("sf_reviews") || "[]");
      existing.unshift(review);
      localStorage.setItem("sf_reviews", JSON.stringify(existing.slice(0, 50)));
    } catch {}
    setSubmitted(true);
    setTimeout(() => handleClose(), 3000);
  }

  return (
    <div
      style={{
        position:   "fixed",
        bottom:     24,
        right:      24,
        zIndex:     9999,
        width:      320,
        background: "#fff",
        borderRadius: 16,
        boxShadow:  "0 8px 40px rgba(0,0,0,0.14), 0 2px 12px rgba(108,92,231,0.12)",
        border:     "1px solid #e8e4f8",
        overflow:   "hidden",
        transform:  visible ? "translateY(0)" : "translateY(130px)",
        opacity:    visible ? 1 : 0,
        transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 4, background: "linear-gradient(90deg, #6c5ce7, #a29bfe, #00d4ff)" }} />

      <div style={{ padding: "16px 18px 18px" }}>
        {!submitted ? (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                  How was your experience? 🌟
                </p>
                <p style={{ margin: "3px 0 0", fontSize: "0.77rem", color: "#94a3b8", lineHeight: 1.4 }}>
                  Your feedback helps us improve MoneySorted
                </p>
              </div>
              <button
                onClick={handleClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px 4px", fontSize: "1rem", lineHeight: 1, flexShrink: 0, marginLeft: 8 }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Stars */}
            <div style={{ display: "flex", gap: 4, margin: "12px 0 10px" }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontSize: "1.7rem", lineHeight: 1,
                    transform: (hovered || rating) >= s ? "scale(1.18)" : "scale(1)",
                    transition: "transform 0.15s ease",
                  }}
                  aria-label={`${s} star`}
                >
                  <span style={{ color: (hovered || rating) >= s ? "#fbbf24" : "#e2e8f0" }}>★</span>
                </button>
              ))}
            </div>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more (optional)"
              rows={3}
              style={{
                width: "100%", borderRadius: 10, border: "1px solid #e2e8f0",
                padding: "8px 10px", fontSize: "0.82rem", color: "#334155",
                resize: "none", outline: "none", boxSizing: "border-box",
                fontFamily: "inherit", lineHeight: 1.5,
              }}
            />

            {/* Name */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              style={{
                width: "100%", borderRadius: 10, border: "1px solid #e2e8f0",
                padding: "8px 10px", fontSize: "0.82rem", color: "#334155",
                outline: "none", boxSizing: "border-box",
                fontFamily: "inherit", marginTop: 8,
              }}
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={rating === 0}
              style={{
                marginTop: 12, width: "100%", padding: "10px",
                borderRadius: 10, border: "none",
                background: rating === 0 ? "#e2e8f0" : "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
                color:   rating === 0 ? "#94a3b8" : "#fff",
                fontWeight: 700, fontSize: "0.88rem",
                cursor: rating === 0 ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
              }}
            >
              Send Feedback
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "22px 0 16px" }}>
            <div style={{ fontSize: "2.6rem", marginBottom: 10 }}>🎉</div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", margin: "0 0 6px" }}>
              Thank you!
            </p>
            <p style={{ fontSize: "0.83rem", color: "#94a3b8", margin: 0 }}>
              Your feedback means a lot.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
