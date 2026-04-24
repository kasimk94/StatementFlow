'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

const BANKS = ['Barclays', 'HSBC', 'Monzo', 'Starling', 'Lloyds', 'NatWest', 'Santander', 'Halifax'];

function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── File row ─────────────────────────────────────────────────────────────────

function FileRow({ file, status, onRemove, isProcessing }) {
  const info = {
    pending:    { label: 'Waiting',       color: '#8A9BB5', dot: '#1E2A3A' },
    processing: { label: 'Processing...', color: '#C9A84C', dot: '#C9A84C' },
    done:       { label: 'Done',          color: '#10B981', dot: '#10B981' },
    error:      { label: 'Failed',        color: '#EF4444', dot: '#EF4444' },
  }[status] || { label: 'Waiting', color: '#8A9BB5', dot: '#1E2A3A' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      background: status === 'processing' ? 'rgba(201,168,76,0.05)' : 'rgba(13,17,23,0.8)',
      borderRadius: 10,
      border: `1px solid ${status === 'processing' ? 'rgba(201,168,76,0.25)' : 'rgba(201,168,76,0.1)'}`,
      transition: 'all 0.2s ease',
    }}>
      {/* Status dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: info.dot, flexShrink: 0 }}/>

      {/* PDF icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ color: '#8A9BB5', fontSize: '0.7rem', marginTop: 1 }}>{fmtSize(file.size)}</div>
      </div>

      <span style={{ color: info.color, fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
        {status === 'done' ? '✅' : status === 'error' ? '❌' : status === 'processing' ? '⏳' : '⬜'} {info.label}
      </span>

      {!isProcessing && status !== 'done' && (
        <button
          onClick={onRemove}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8A9BB5', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#8A9BB5'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Main upload page ─────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const isPro    = ['PRO', 'BUSINESS'].includes(session?.user?.plan);
  const maxFiles = isPro ? 6 : 1;

  const [files,       setFiles]       = useState([]);
  const [statuses,    setStatuses]    = useState([]);
  const [resultIds,   setResultIds]   = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProBanner, setShowProBanner] = useState(false);
  const [error,       setError]       = useState(null);
  const [dragErr,     setDragErr]     = useState(null);
  const [allDone,     setAllDone]     = useState(false);

  const doneCount = statuses.filter(s => s === 'done').length;

  // Navigate after all done
  useEffect(() => {
    if (!allDone) return;
    const ids = resultIds.filter(Boolean);
    const t = setTimeout(() => {
      if (ids.length === 1) {
        router.push(`/dashboard?statementId=${ids[0]}`);
      } else if (ids.length > 1) {
        router.push(`/dashboard/combined?ids=${ids.join(',')}`);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [allDone]); // eslint-disable-line

  function addFiles(incoming) {
    setDragErr(null);
    const pdfs = incoming.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) { setDragErr('Only PDF files are accepted.'); return; }

    const slots = maxFiles - files.length;
    if (slots <= 0) return;

    const toAdd = pdfs.slice(0, slots);
    if (pdfs.length > slots && !isPro) setShowProBanner(true);

    setFiles(p     => [...p, ...toAdd]);
    setStatuses(p  => [...p, ...toAdd.map(() => 'pending')]);
    setResultIds(p => [...p, ...toAdd.map(() => null)]);
  }

  function removeFile(idx) {
    setFiles(p     => p.filter((_, i) => i !== idx));
    setStatuses(p  => p.filter((_, i) => i !== idx));
    setResultIds(p => p.filter((_, i) => i !== idx));
    if (files.length - 1 < maxFiles) setShowProBanner(false);
  }

  async function handleUpload() {
    if (!files.length || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    const ids = [...resultIds];

    for (let i = 0; i < files.length; i++) {
      if (statuses[i] === 'done') continue;
      setStatuses(p => { const n = [...p]; n[i] = 'processing'; return n; });

      try {
        const fd = new FormData();
        fd.append('file', files[i]);
        const res  = await fetch('/api/convert', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || 'Conversion failed');
        ids[i] = json.statementId || null;
        setResultIds([...ids]);
        setStatuses(p => { const n = [...p]; n[i] = 'done'; return n; });
      } catch (err) {
        setStatuses(p => { const n = [...p]; n[i] = 'error'; return n; });
        setError(`"${files[i].name}" failed: ${err.message}`);
      }
    }

    setIsProcessing(false);

    const succeeded = ids.filter(Boolean);
    if (succeeded.length > 0) setAllDone(true);
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop: useCallback((accepted, rejected) => {
      if (rejected.length) { setDragErr('Only PDF files are accepted.'); return; }
      addFiles(accepted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files, isPro, maxFiles]),
    accept:   { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: isProcessing || files.length >= maxFiles,
    noClick:  true,
  });

  const canAddMore = files.length < maxFiles && !isProcessing;
  const canUpload  = files.length > 0 && !isProcessing && statuses.some(s => s === 'pending' || s === 'error') && !allDone;

  const borderColor = isDragReject ? 'rgba(239,68,68,0.6)' : isDragActive ? 'rgba(201,168,76,0.7)' : 'rgba(201,168,76,0.3)';
  const bgColor     = isDragReject ? 'rgba(239,68,68,0.04)' : isDragActive ? 'rgba(201,168,76,0.06)' : '#0D1117';

  const progressPct = files.length > 0 ? (doneCount / files.length) * 100 : 0;

  return (
    <DashboardLayout title="Upload Statement">
      <style>{`
        @keyframes up-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes up-spin  { to { transform: rotate(360deg); } }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Upload Statement{files.length > 1 ? 's' : ''}
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          {isPro
            ? 'Upload up to 6 statements for a combined multi-bank analysis'
            : 'Upload a bank statement PDF to analyse your transactions'}
        </p>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* ── Drop zone ── */}
        {canAddMore && (
          <div
            {...getRootProps()}
            style={{
              background: bgColor, border: `2px dashed ${borderColor}`,
              borderRadius: 16, cursor: 'pointer',
              transition: 'border-color 0.2s ease, background 0.2s ease',
              marginBottom: files.length > 0 ? 12 : 0,
            }}
          >
            <input {...getInputProps()} />

            {isDragActive && !isDragReject ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: 12 }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: 'up-float 0.85s ease-in-out infinite' }}>
                  <polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#C9A84C' }}>Drop it here!</p>
              </div>
            ) : isDragReject ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', gap: 12 }}>
                <span style={{ fontSize: '2.5rem' }}>⛔</span>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#EF4444' }}>PDF files only</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: files.length > 0 ? '28px 32px' : '48px 32px', gap: files.length > 0 ? 12 : 18 }}>
                <svg width={files.length > 0 ? 36 : 44} height={files.length > 0 ? 36 : 44} viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: 'up-float 2.2s ease-in-out infinite', filter: 'drop-shadow(0 4px 12px rgba(201,168,76,0.35))' }}>
                  <polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: files.length > 0 ? '0.95rem' : '1.05rem', fontWeight: 600, color: '#F5F0E8' }}>
                    {files.length > 0 ? 'Add another statement' : 'Drop your bank statement here'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#8A9BB5' }}>
                    Supports PDF files up to 10MB{isPro ? ` · Up to ${maxFiles} files` : ''}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); open(); }}
                  style={{
                    background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14',
                    fontWeight: 700, fontSize: '0.875rem', padding: '10px 24px',
                    borderRadius: 50, border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(201,168,76,0.35)',
                  }}
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* File counter */}
        {files.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#8A9BB5', fontSize: '0.75rem' }}>
              {files.length} / {maxFiles} files added
            </span>
            {!isProcessing && !allDone && files.length > 0 && (
              <button
                onClick={() => { setFiles([]); setStatuses([]); setResultIds([]); setShowProBanner(false); setError(null); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8A9BB5', fontSize: '0.75rem' }}
                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#8A9BB5'}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Pro banner */}
        {showProBanner && !isPro && (
          <div style={{
            background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#C9A84C', fontWeight: 500 }}>
              ⭐ Upgrade to Pro to upload multiple statements at once
            </p>
            <Link href="/account#upgrade" style={{
              background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', color: '#080C14',
              fontWeight: 700, fontSize: '0.75rem', padding: '6px 14px', borderRadius: 999, textDecoration: 'none',
            }}>
              Upgrade →
            </Link>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {files.map((file, i) => (
              <FileRow
                key={`${file.name}-${i}`}
                file={file}
                status={statuses[i] || 'pending'}
                onRemove={() => removeFile(i)}
                isProcessing={isProcessing}
              />
            ))}
          </div>
        )}

        {/* Overall progress bar */}
        {isProcessing && files.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#8A9BB5', fontSize: '0.78rem' }}>Analysing statements...</span>
              <span style={{ color: '#C9A84C', fontSize: '0.78rem', fontWeight: 700 }}>
                {doneCount} of {files.length} complete
              </span>
            </div>
            <div style={{ height: 5, background: '#1E2A3A', borderRadius: 999 }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: 'linear-gradient(90deg,#C9A84C,#E8C97A)',
                width: `${progressPct}%`, transition: 'width 0.4s ease',
              }}/>
            </div>
          </div>
        )}

        {/* All done */}
        {allDone && (
          <div style={{
            textAlign: 'center', marginBottom: 16, padding: '14px',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12,
          }}>
            <p style={{ color: '#10B981', fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>
              ✅ All done! Redirecting to your dashboard...
            </p>
          </div>
        )}

        {/* API error */}
        {error && (
          <div style={{
            marginBottom: 16, background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px',
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#EF4444' }}>{error}</p>
          </div>
        )}

        {dragErr && (
          <p style={{ marginBottom: 12, fontSize: '0.85rem', color: '#EF4444', textAlign: 'center' }}>⚠ {dragErr}</p>
        )}

        {/* Upload button */}
        {files.length > 0 && !allDone && (
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              width: '100%',
              background: canUpload ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : 'rgba(201,168,76,0.15)',
              color: canUpload ? '#080C14' : '#8A9BB5',
              fontWeight: 700, fontSize: '1rem', padding: '14px 28px',
              borderRadius: 50, border: 'none', cursor: canUpload ? 'pointer' : 'not-allowed',
              boxShadow: canUpload ? '0 4px 16px rgba(201,168,76,0.35)' : 'none',
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isProcessing ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'up-spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Analysing {doneCount + 1} of {files.length}...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                </svg>
                Upload & Analyse {files.length > 1 ? `${files.length} Statements` : 'Statement'}
              </>
            )}
          </button>
        )}

        {/* Supported banks (idle state only) */}
        {files.length === 0 && (
          <div style={{ marginTop: 28 }}>
            <p style={{ color: '#8A9BB5', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
              Supported banks
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {BANKS.map(bank => (
                <span key={bank} style={{
                  background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
                  color: '#8A9BB5', fontSize: '0.78rem', fontWeight: 500, padding: '5px 12px', borderRadius: 999,
                }}>
                  {bank}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pro upgrade hint for free users with no files */}
        {files.length === 0 && !isPro && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <p style={{ color: '#8A9BB5', fontSize: '0.78rem', margin: 0 }}>
              Want to upload multiple statements?{' '}
              <Link href="/account#upgrade" style={{ color: '#C9A84C', fontWeight: 600, textDecoration: 'none' }}>
                Upgrade to Pro →
              </Link>
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
