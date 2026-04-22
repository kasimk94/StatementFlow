'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import DashboardLayout from '@/components/DashboardLayout';

// ─── Progress helpers (shared with UploadZone) ────────────────────────────────

const IC = '#C9A84C';
const R    = 44;
const CIRC = +(2 * Math.PI * R).toFixed(3);

const STEP_ICONS = [
  <svg key="s0" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9"  x2="8"  y2="9"/>
  </svg>,
  <svg key="s1" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>,
  <svg key="s2" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>,
  <svg key="s3" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>,
];

const STEP_LABELS = [
  'Reading your PDF...',
  'Extracting transactions...',
  'AI analysis in progress...',
  'Almost there...',
];

function stepFromProgress(pct) {
  if (pct < 30) return 0;
  if (pct < 60) return 1;
  if (pct < 85) return 2;
  return 3;
}

function rateFromProgress(pct) {
  if (pct < 30) return 15;
  if (pct < 60) return 10;
  if (pct < 85) return 7;
  return 1.2;
}

// ─── Supported banks ──────────────────────────────────────────────────────────

const BANKS = ['Barclays', 'HSBC', 'Monzo', 'Starling', 'Lloyds', 'NatWest', 'Santander', 'Halifax'];

// ─── Processing overlay ───────────────────────────────────────────────────────

function ProcessingOverlay({ progress, isComplete }) {
  const stepIdx = isComplete ? 3 : stepFromProgress(progress);
  const offset  = CIRC * (1 - progress / 100);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 32px', gap: 0,
    }}>
      <div key={stepIdx} style={{ marginBottom: 16, lineHeight: 1 }}>
        {isComplete
          ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={IC} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          : STEP_ICONS[stepIdx]
        }
      </div>

      <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#1E2A3A" strokeWidth="5.5"/>
          <circle
            cx="50" cy="50" r={R} fill="none"
            stroke="#C9A84C" strokeWidth="5.5" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 300ms cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F5F0E8', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {progress}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>%</span>
          </div>
        </div>
      </div>

      <p key={`lbl-${stepIdx}-${isComplete}`} style={{
        color: '#F5F0E8', fontSize: '0.85rem', fontWeight: 600,
        marginTop: 16, textAlign: 'center',
      }}>
        {isComplete ? 'Complete! ✓' : STEP_LABELS[stepIdx]}
      </p>

      {!isComplete && (
        <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
          {[0, 0.18, 0.36].map((delay, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: '#C9A84C',
              animation: 'up-dot 1.3s ease-in-out infinite',
              animationDelay: `${delay}s`,
            }}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main upload page ─────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();

  const [loading,    setLoading]    = useState(false);
  const [apiDone,    setApiDone]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error,      setError]      = useState(null);
  const [dragErr,    setDragErr]    = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // RAF-based smooth progress animation
  useEffect(() => {
    if (!loading) { setProgress(0); setIsComplete(false); return; }
    let current = 0;
    let animId;
    let alive    = true;
    let lastTime = performance.now();

    function tick(now) {
      if (!alive) return;
      const dt = (now - lastTime) / 1000;
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

  // When API done: jump to 100%, flash Complete, then navigate
  useEffect(() => {
    if (!apiDone) return;
    setProgress(100);
    setIsComplete(true);
  }, [apiDone]);

  async function handleFile(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setDragErr('Only PDF files are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setDragErr('File must be under 10MB.');
      return;
    }

    setError(null);
    setDragErr(null);
    setLoading(true);
    setApiDone(false);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res  = await fetch('/api/convert', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || 'Conversion failed');
      }

      setApiDone(true);

      // Brief flash of "Complete!" then navigate
      setTimeout(() => {
        if (json.statementId) {
          router.push(`/dashboard?statementId=${json.statementId}`);
        } else {
          router.push('/dashboard');
        }
      }, 700);
    } catch (err) {
      setLoading(false);
      setApiDone(false);
      setError(err.message || 'Something went wrong. Please try again.');
    }
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop: useCallback((accepted, rejected) => {
      setDragErr(null);
      if (rejected.length > 0) { setDragErr('Only PDF files are accepted.'); return; }
      if (accepted.length > 0)  { handleFile(accepted[0]); }
    }, []),
    accept:   { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: loading,
  });

  const borderColor = isDragReject
    ? 'rgba(239,68,68,0.6)'
    : isDragActive
    ? 'rgba(201,168,76,0.7)'
    : 'rgba(201,168,76,0.3)';

  const bgColor = isDragReject
    ? 'rgba(239,68,68,0.04)'
    : isDragActive
    ? 'rgba(201,168,76,0.06)'
    : '#0D1117';

  return (
    <DashboardLayout title="Upload Statement">
      <style>{`
        @keyframes up-dot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.35; }
          30%            { transform: translateY(-5px); opacity: 1;    }
        }
        @keyframes up-float {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-8px); }
        }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700,
          margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>
          Upload Statement
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          Upload a bank statement PDF to analyse your transactions
        </p>
      </div>

      {/* Centred upload card */}
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          style={{
            background:    bgColor,
            border:        `2px dashed ${borderColor}`,
            borderRadius:  16,
            cursor:        loading ? 'not-allowed' : 'pointer',
            transition:    'border-color 0.2s ease, background 0.2s ease',
            overflow:      'hidden',
          }}
        >
          <input {...getInputProps()} />

          {loading ? (
            <ProcessingOverlay progress={progress} isComplete={isComplete} />
          ) : isDragActive && !isDragReject ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 32px', gap: 12,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'up-float 0.85s ease-in-out infinite' }}>
                <polyline points="16,16 12,12 8,16"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#C9A84C' }}>
                Drop it here!
              </p>
            </div>
          ) : isDragReject ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 32px', gap: 12,
            }}>
              <span style={{ fontSize: '2.5rem' }}>⛔</span>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#EF4444' }}>
                PDF files only
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 32px', gap: 18,
            }}>
              {/* Upload icon */}
              <svg
                width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="#C9A84C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: 'up-float 2.2s ease-in-out infinite', filter: 'drop-shadow(0 4px 12px rgba(201,168,76,0.35))' }}
              >
                <polyline points="16,16 12,12 8,16"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>

              {/* Copy */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 600, color: '#F5F0E8' }}>
                  Drop your bank statement here
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#8A9BB5' }}>
                  Supports PDF files up to 10MB · All major UK banks supported
                </p>
              </div>

              {/* Browse button */}
              <button
                onClick={(e) => { e.stopPropagation(); open(); }}
                style={{
                  background:    'linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)',
                  color:         '#080C14',
                  fontWeight:    700,
                  fontSize:      '0.9rem',
                  padding:       '11px 28px',
                  borderRadius:  50,
                  border:        'none',
                  cursor:        'pointer',
                  boxShadow:     '0 4px 16px rgba(201,168,76,0.35)',
                  display:       'flex',
                  alignItems:    'center',
                  gap:           8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(201,168,76,0.5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(201,168,76,0.35)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Drag / type errors */}
        {dragErr && (
          <p style={{ marginTop: 10, fontSize: '0.85rem', color: '#EF4444', textAlign: 'center' }}>
            ⚠ {dragErr}
          </p>
        )}

        {/* API error */}
        {error && (
          <div style={{
            marginTop: 16,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 12,
            padding: '14px 18px',
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' }}>
              Upload failed
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#8A9BB5', lineHeight: 1.5 }}>
              {/scanned|image.based|could not read/i.test(error)
                ? 'This looks like a scanned PDF — we can\'t read image-based statements yet. Please download your statement directly from your bank\'s app or website as a digital PDF.'
                : error
              }
            </p>
          </div>
        )}

        {/* Supported banks */}
        {!loading && (
          <div style={{ marginTop: 28 }}>
            <p style={{ color: '#8A9BB5', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
              Supported banks
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {BANKS.map(bank => (
                <span key={bank} style={{
                  background: 'rgba(201,168,76,0.06)',
                  border: '1px solid rgba(201,168,76,0.15)',
                  color: '#8A9BB5',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  padding: '5px 12px',
                  borderRadius: 999,
                }}>
                  {bank}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
