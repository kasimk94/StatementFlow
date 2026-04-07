"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";

// ─── Loading steps ────────────────────────────────────────────────────────────
const IC = "#6c5ce7";

// Icons indexed 0-3 by progress phase
const STEP_ICONS = [
  // 0: 0-29% — Reading PDF
  <svg key="s0" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9"  x2="8"  y2="9"/>
  </svg>,
  // 1: 30-59% — Extracting
  <svg key="s1" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>,
  // 2: 60-84% — AI analysis
  <svg key="s2" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>,
  // 3: 85-99% — Almost there
  <svg key="s3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>,
];

const STEP_LABELS = [
  "Reading your PDF...",
  "Extracting transactions...",
  "AI analysis in progress...",
  "Almost there...",
];

// Progress → step index
function stepFromProgress(pct) {
  if (pct < 30) return 0;
  if (pct < 60) return 1;
  if (pct < 85) return 2;
  return 3;
}

// Progress rate (%/second) by current value
function rateFromProgress(pct) {
  if (pct < 30) return 15;   // fast   — ~2s
  if (pct < 60) return 10;   // medium — ~3s
  if (pct < 85) return 7;    // slower — ~3.6s
  return 1.2;                 // crawl  — waits for API
}

// SVG ring constants
const R    = 44;
const CIRC = +(2 * Math.PI * R).toFixed(3);

// ─── Keyframes (shared by loading overlay + new upload icon) ──────────────────
const KEYFRAMES = `
@keyframes uz-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes uz-text-in {
  from { opacity: 0; transform: translateY(7px); }
  to   { opacity: 1; transform: translateY(0);   }
}
@keyframes uz-icon-in {
  from { opacity: 0; transform: scale(0.75); }
  to   { opacity: 1; transform: scale(1);    }
}
@keyframes uz-icon-pulse {
  0%, 100% { transform: scale(1);    }
  50%       { transform: scale(1.12); }
}
@keyframes uz-dot {
  0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
  30%            { transform: translateY(-5px); opacity: 1;    }
}
@keyframes uz-float {
  0%, 100% { transform: translateY(0px);  }
  50%       { transform: translateY(-9px); }
}
@keyframes uz-float-fast {
  0%, 100% { transform: translateY(0px)   scale(1);    }
  50%       { transform: translateY(-5px) scale(1.07); }
}
@keyframes uz-border-spin {
  0%   { background-position: 0%   50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0%   50%; }
}
`;

// ─── LoadingOverlay ───────────────────────────────────────────────────────────
function LoadingOverlay({ progress, isComplete }) {
  const stepIdx = isComplete ? 3 : stepFromProgress(progress);

  const offset = CIRC * (1 - progress / 100);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background:   "linear-gradient(160deg, #ffffff 0%, #f0f4ff 100%)",
        animation:    "uz-fade-in 0.3s ease forwards",
        zIndex:       10,
        paddingTop:   "40px",
        paddingBottom:"40px",
        boxSizing:    "border-box",
        borderRadius: 20,
      }}
    >
      {/* Step icon — swap to checkmark at 100% */}
      <div
        key={stepIdx}
        style={{
          lineHeight: 1,
          marginBottom: 14,
          animation: isComplete
            ? "uz-icon-in 0.3s ease forwards"
            : "uz-icon-in 0.3s ease forwards, uz-icon-pulse 2.2s ease-in-out 0.3s infinite",
        }}
      >
        {isComplete ? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        ) : STEP_ICONS[stepIdx]}
      </div>

      {/* Progress ring */}
      <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
        <svg
          width="160" height="160" viewBox="0 0 100 100"
          style={{ overflow: "visible" }}
        >
          <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="5.5" />
          <circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke="#6c5ce7"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            style={{
              transition: "stroke-dashoffset 300ms cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {progress}
            </span>
            <span style={{ fontSize: "1rem", fontWeight: 600, color: "#94a3b8", lineHeight: 1 }}>
              %
            </span>
          </div>
        </div>
      </div>

      {/* Step label */}
      <p
        key={`label-${stepIdx}-${isComplete}`}
        style={{
          color: "#2d3436", fontSize: "0.8rem", fontWeight: 600,
          letterSpacing: "0.01em", marginTop: 16, textAlign: "center",
          animation: "uz-text-in 0.3s ease forwards",
        }}
      >
        {isComplete ? "Complete! ✓" : STEP_LABELS[stepIdx]}
      </p>

      {/* Pulsing dots — hidden when complete */}
      {!isComplete && (
        <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
          {[0, 0.18, 0.36].map((delay, i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#6c5ce7",
                animation: `uz-dot 1.3s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
      )}

      <p style={{ color: "#94a3b8", fontSize: "0.68rem", textAlign: "center", marginTop: 18, paddingInline: 20, lineHeight: 1.4 }}>
        🔒 Your data is never stored or shared
      </p>
    </div>
  );
}

// ─── Animated upload cloud icon ───────────────────────────────────────────────
function CloudUploadIcon({ size = 72, color = "#6c5ce7", fast = false }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation:  fast ? "uz-float-fast 0.85s ease-in-out infinite" : "uz-float 2.2s ease-in-out infinite",
        flexShrink: 0,
        filter:     `drop-shadow(0 6px 18px ${color}55)`,
      }}
    >
      {/* Cloud body */}
      <path
        d="M17 43a11 11 0 01-1.5-21.9A15 15 0 0145 25l1 .1A11 11 0 0146 47H17z"
        fill={color} fillOpacity="0.12"
        stroke={color} strokeWidth="2" strokeLinejoin="round"
      />
      {/* Arrow shaft */}
      <line x1="32" y1="46" x2="32" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Arrow head */}
      <polyline points="24,35 32,27 40,35" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── UploadZone ───────────────────────────────────────────────────────────────
export default function UploadZone({ onFile, loading, apiDone = false, onAnimationDone, error = null }) {
  const isScannedError =
    error &&
    /scanned|image.based|could not read this pdf/i.test(error);

  const [dragError,   setDragError]   = useState(null);
  const [progress,    setProgress]    = useState(0);
  const [isComplete,  setIsComplete]  = useState(false);

  // RAF-based smooth progress simulation: 0 → 95%
  useEffect(() => {
    if (!loading) { setProgress(0); setIsComplete(false); return; }
    let current = 0;
    let animId;
    let alive    = true;
    let lastTime = performance.now();

    function tick(now) {
      if (!alive) return;
      const dt = (now - lastTime) / 1000; // seconds
      lastTime  = now;
      if (current < 95) {
        current = Math.min(current + rateFromProgress(current) * dt, 95);
        setProgress(Math.round(current));
      }
      animId = requestAnimationFrame(tick);
    }
    animId = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(animId); };
  }, [loading]);

  // When API responds: jump to 100%, show Complete for 600ms, then show dashboard
  useEffect(() => {
    if (!apiDone || !loading) return;
    setProgress(100);
    setIsComplete(true);
    const t = setTimeout(() => { if (onAnimationDone) onAnimationDone(); }, 600);
    return () => clearTimeout(t);
  }, [apiDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((accepted, rejected) => {
    setDragError(null);
    if (rejected.length > 0) { setDragError("Only PDF files are accepted."); return; }
    if (accepted.length > 0) { onFile(accepted[0]); }
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept:   { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: loading,
  });

  // ── Gradient border colours based on state ──
  const borderGrad = isDragReject
    ? "linear-gradient(135deg,#e17055,#d63031)"
    : isDragActive
    ? "linear-gradient(135deg,#00d4ff,#6c5ce7,#00b894)"
    : "linear-gradient(135deg,#6c5ce7,#00d4ff,#00b894)";

  const borderGlow = isDragReject
    ? "0 0 28px rgba(214,48,49,0.45), 0 4px 20px rgba(0,0,0,0.08)"
    : isDragActive
    ? "0 0 40px rgba(108,92,231,0.55), 0 0 70px rgba(0,212,255,0.3), 0 4px 20px rgba(0,0,0,0.06)"
    : "0 0 18px rgba(108,92,231,0.14), 0 0 40px rgba(0,212,255,0.08), 0 4px 16px rgba(0,0,0,0.05)";

  const innerBg = isDragReject ? "#fff5f5" : isDragActive ? "#f0f0ff" : "#f8faff";

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* ── Gradient border wrapper ── */}
        <div
          style={{
            background:   borderGrad,
            borderRadius: 22,
            padding:      2,
            boxShadow:    borderGlow,
            transition:   "box-shadow 0.35s ease, background 0.35s ease",
          }}
        >
          {/* ── Inner card ── */}
          <div
            {...getRootProps()}
            style={{
              borderRadius:   20,
              background:     innerBg,
              minHeight:      loading ? 420 : 300,
              padding:        "2.75rem 2.25rem",
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              textAlign:      "center",
              cursor:         loading ? "not-allowed" : "pointer",
              transition:     "background 0.25s ease",
              position:       "relative",
              overflow:       "hidden",
              boxSizing:      "border-box",
              gap:            0,
            }}
          >
            <input {...getInputProps()} />

            {/* ── LOADING OVERLAY ── */}
            {loading && <LoadingOverlay progress={progress} isComplete={isComplete} />}

            {/* ── DRAG ACTIVE ── */}
            {!loading && isDragActive && !isDragReject && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <CloudUploadIcon size={72} color="#6c5ce7" fast />
                <p style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#6c5ce7" }}>
                  Drop it here!
                </p>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#a29bfe" }}>
                  Release to upload your PDF
                </p>
              </div>
            )}

            {/* ── DRAG REJECT ── */}
            {!loading && isDragReject && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: "3rem", lineHeight: 1 }}>⛔</div>
                <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#d63031" }}>
                  PDF files only
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#e17055" }}>
                  This file type is not supported
                </p>
              </div>
            )}

            {/* ── IDLE DEFAULT ── */}
            {!loading && !isDragActive && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                {/* Floating upload icon */}
                <CloudUploadIcon size={72} color="#6c5ce7" />

                {/* Copy */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
                    Drag & drop your PDF here
                  </p>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>
                    or
                  </p>
                </div>

                {/* Browse button */}
                <button
                  onClick={(e) => { e.stopPropagation(); open(); }}
                  style={{
                    background:    "linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%)",
                    color:         "#fff",
                    fontWeight:    700,
                    fontSize:      "0.95rem",
                    padding:       "11px 30px",
                    borderRadius:  12,
                    border:        "none",
                    cursor:        "pointer",
                    boxShadow:     "0 6px 20px rgba(108,92,231,0.32)",
                    transition:    "transform 0.15s ease, box-shadow 0.2s ease",
                    display:       "flex",
                    alignItems:    "center",
                    gap:           8,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 12px 28px rgba(108,92,231,0.48)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(108,92,231,0.32)";
                  }}
                >
                  {/* Folder icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Browse Files
                </button>
              </div>
            )}

          </div>
        </div>

        {/* ── Drag/type error ── */}
        {dragError && (
          <p style={{ marginTop: 10, fontSize: "0.85rem", color: "#d63031", textAlign: "center", fontWeight: 500 }}>
            ⚠ {dragError}
          </p>
        )}

        {/* ── Scanned PDF warning (amber) ── */}
        {isScannedError && (
          <div
            style={{
              marginTop: 12,
              background: "#fffbeb",
              border: "1.5px solid #f59e0b",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1.3, flexShrink: 0 }}>📄</span>
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#92400e" }}>
                Scanned PDF detected
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#b45309", lineHeight: 1.5 }}>
                This looks like a scanned PDF — we can&apos;t read image-based statements yet.
                Please download your statement directly from your bank&apos;s app or website as a
                digital PDF.
              </p>
            </div>
          </div>
        )}

        {/* ── Supporting text ── */}
        <p style={{ marginTop: 10, fontSize: "0.77rem", color: "#94a3b8", textAlign: "center", letterSpacing: "0.01em" }}>
          Supports PDF files up to 10MB
        </p>

      </div>
    </>
  );
}
