"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";

// ─── Loading steps ────────────────────────────────────────────────────────────
const IC = "#6c5ce7";
const STEPS = [
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9"  x2="8"  y2="9"/>
      </svg>
    ),
    label: "Reading your PDF...", to: 30,
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    label: "Extracting transactions...", to: 60,
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    label: "Categorising payments...", to: 85,
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
    label: "Building your dashboard...", to: 100,
  },
];
const DURATIONS = [800, 800, 800, 600];

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
function LoadingOverlay({ step, progress }) {
  const [displayPct, setDisplayPct] = useState(0);
  const rafRef  = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    const to   = progress;
    const dur  = DURATIONS[step] ?? 600;
    const t0   = performance.now();

    function tick(now) {
      const f     = Math.min((now - t0) / dur, 1);
      const eased = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      const cur   = Math.round(from + (to - from) * eased);
      fromRef.current = cur;
      setDisplayPct(cur);
      if (f < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Step icon */}
      <div
        key={step}
        style={{
          lineHeight: 1,
          marginBottom: 14,
          animation: "uz-icon-in 0.3s ease forwards, uz-icon-pulse 2.2s ease-in-out 0.3s infinite",
        }}
      >
        {STEPS[step].icon}
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
              transition: `stroke-dashoffset ${DURATIONS[step] ?? 600}ms cubic-bezier(0.4,0,0.2,1)`,
            }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {displayPct}
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", alignSelf: "flex-end", paddingBottom: "5px", marginLeft: "1px" }}>
            %
          </span>
        </div>
      </div>

      {/* Step label */}
      <p
        key={`label-${step}`}
        style={{
          color: "#2d3436", fontSize: "0.8rem", fontWeight: 600,
          letterSpacing: "0.01em", marginTop: 16, textAlign: "center",
          animation: "uz-text-in 0.3s ease forwards",
        }}
      >
        {STEPS[step].label}
      </p>

      {/* Pulsing dots */}
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

// ─── File size formatter ──────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── UploadZone ───────────────────────────────────────────────────────────────
export default function UploadZone({ onFile, loading }) {
  const [dragError,    setDragError]    = useState(null);
  const [step,         setStep]         = useState(0);
  const [progress,     setProgress]     = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);

  // Loading step progression
  useEffect(() => {
    if (!loading) { setStep(0); setProgress(0); return; }
    let alive = true;
    const timers = [];
    function advance(idx) {
      if (!alive || idx >= STEPS.length) return;
      setStep(idx);
      setProgress(STEPS[idx].to);
      if (idx + 1 < STEPS.length)
        timers.push(setTimeout(() => advance(idx + 1), DURATIONS[idx]));
    }
    timers.push(setTimeout(() => advance(0), 40));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [loading]);

  const onDrop = useCallback((accepted, rejected) => {
    setDragError(null);
    if (rejected.length > 0) { setDragError("Only PDF files are accepted."); return; }
    if (accepted.length > 0) { setSelectedFile(accepted[0]); }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept:   { "application/pdf": [".pdf"] },
    multiple: false,
    disabled: loading,
    noClick:  !!selectedFile && !loading, // prevent click-to-open when previewing
  });

  function handleRemove(e) {
    e.stopPropagation();
    setSelectedFile(null);
    setDragError(null);
  }

  function handleConvert(e) {
    e.stopPropagation();
    if (selectedFile) onFile(selectedFile);
  }

  // ── Gradient border colours based on state ──
  const borderGrad = isDragReject
    ? "linear-gradient(135deg,#e17055,#d63031)"
    : isDragActive
    ? "linear-gradient(135deg,#00d4ff,#6c5ce7,#00b894)"
    : selectedFile
    ? "linear-gradient(135deg,#00b894,#00d4ff,#6c5ce7)"
    : "linear-gradient(135deg,#6c5ce7,#00d4ff,#00b894)";

  const borderGlow = isDragReject
    ? "0 0 28px rgba(214,48,49,0.45), 0 4px 20px rgba(0,0,0,0.08)"
    : isDragActive
    ? "0 0 40px rgba(108,92,231,0.55), 0 0 70px rgba(0,212,255,0.3), 0 4px 20px rgba(0,0,0,0.06)"
    : selectedFile
    ? "0 0 28px rgba(0,212,255,0.28), 0 0 50px rgba(0,184,148,0.2), 0 4px 20px rgba(0,0,0,0.06)"
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
              cursor:         loading ? "not-allowed" : selectedFile ? "default" : "pointer",
              transition:     "background 0.25s ease",
              position:       "relative",
              overflow:       "hidden",
              boxSizing:      "border-box",
              gap:            0,
            }}
          >
            <input {...getInputProps()} />

            {/* ── LOADING OVERLAY ── */}
            {loading && <LoadingOverlay step={step} progress={progress} />}

            {/* ── FILE PREVIEW ── */}
            {!loading && selectedFile && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" }}>

                {/* Floating purple PDF icon */}
                <div style={{ lineHeight: 1, animation: "uz-float 2s ease-in-out infinite" }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9"  x2="8"  y2="9"/>
                  </svg>
                </div>

                {/* File info strip */}
                <div
                  style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          16,
                    background:   "#ffffff",
                    borderRadius: 16,
                    border:       "1.5px solid #e2e8f0",
                    padding:      "18px 22px",
                    width:        "100%",
                    boxShadow:    "0 2px 16px rgba(108,92,231,0.08)",
                    boxSizing:    "border-box",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedFile.name}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                      {fmtSize(selectedFile.size)} · PDF document
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={handleRemove}
                    title="Remove file"
                    style={{
                      width:           32,
                      height:          32,
                      borderRadius:    "50%",
                      border:          "none",
                      background:      "#fee2e2",
                      color:           "#ef4444",
                      fontSize:        "0.82rem",
                      fontWeight:      800,
                      cursor:          "pointer",
                      flexShrink:      0,
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      transition:      "background 0.15s, transform 0.15s",
                      lineHeight:      1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#fecaca"; e.currentTarget.style.transform = "scale(1.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.transform = "scale(1)";   }}
                  >
                    ✕
                  </button>
                </div>

                {/* Ready indicator */}
                <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#00b894", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  File ready to convert
                </p>

                {/* Convert button — full width */}
                <button
                  onClick={handleConvert}
                  style={{
                    background:     "linear-gradient(135deg, #2563eb 0%, #6c5ce7 100%)",
                    color:          "#fff",
                    fontWeight:     700,
                    fontSize:       "1.05rem",
                    padding:        "15px 0",
                    borderRadius:   14,
                    border:         "none",
                    cursor:         "pointer",
                    boxShadow:      "0 8px 24px rgba(108,92,231,0.35)",
                    transition:     "transform 0.15s ease, box-shadow 0.2s ease",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            8,
                    width:          "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 14px 32px rgba(108,92,231,0.52)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(108,92,231,0.35)";
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Convert PDF
                </button>

                {/* Change file hint */}
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
                  Wrong file?{" "}
                  <button
                    onClick={handleRemove}
                    style={{ background: "none", border: "none", padding: 0, color: "#6c5ce7", fontWeight: 600, cursor: "pointer", fontSize: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
                  >
                    Choose another
                  </button>
                </p>
              </div>
            )}

            {/* ── DRAG ACTIVE ── */}
            {!loading && !selectedFile && isDragActive && !isDragReject && (
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
            {!loading && !selectedFile && isDragReject && (
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
            {!loading && !selectedFile && !isDragActive && (
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

        {/* ── Error ── */}
        {dragError && (
          <p style={{ marginTop: 10, fontSize: "0.85rem", color: "#d63031", textAlign: "center", fontWeight: 500 }}>
            ⚠ {dragError}
          </p>
        )}

        {/* ── Supporting text ── */}
        <p style={{ marginTop: 10, fontSize: "0.77rem", color: "#94a3b8", textAlign: "center", letterSpacing: "0.01em" }}>
          Supports PDF files up to 10MB
        </p>

      </div>
    </>
  );
}
