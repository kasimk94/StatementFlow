'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import UpgradeModal from '@/components/UpgradeModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7,10 12,15 17,10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div style={{
      background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            height: 88,
            borderBottom: i < 2 ? '1px solid rgba(30,42,58,0.4)' : 'none',
            background: '#0D1117',
            animation: 'sf-pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
      <DocIcon />
      <p style={{ color: '#F5F0E8', fontSize: '1.1rem', fontWeight: 600, margin: '20px 0 8px' }}>
        No statements to export
      </p>
      <p style={{ color: '#8A9BB5', fontSize: '0.875rem', margin: '0 0 24px' }}>
        Upload a bank statement first, then you can download it as Excel or CSV.
      </p>
      <Link href="/statements" style={{
        background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
        color: '#080C14',
        fontWeight: 700,
        fontSize: '0.875rem',
        padding: '10px 24px',
        borderRadius: 50,
        textDecoration: 'none',
        display: 'inline-block',
      }}>
        Upload Statement
      </Link>
    </div>
  );
}

// ─── Statement Row ────────────────────────────────────────────────────────────

function StatementExportRow({ stmt, isLast, downloading, onExcel, onCSV }) {
  const [hovered, setHovered] = useState(false);
  const isExcelLoading = downloading === stmt.id + '_excel';
  const isCSVLoading = downloading === stmt.id + '_csv';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '20px 24px',
        borderBottom: isLast ? 'none' : '1px solid rgba(30,42,58,0.4)',
        background: hovered ? 'rgba(201,168,76,0.03)' : 'transparent',
        transition: 'background 150ms ease',
      }}
    >
      {/* Left: statement info */}
      <div>
        <div style={{ color: '#F5F0E8', fontWeight: 700, fontSize: '0.95rem' }}>
          {stmt.bankName || 'Unknown Bank'}
        </div>
        <div style={{ color: '#8A9BB5', fontSize: '0.8rem', marginTop: 2 }}>
          {fmtDate(stmt.dateFrom)} – {fmtDate(stmt.dateTo)}
        </div>
        <div style={{ color: '#8A9BB5', fontSize: '0.75rem', marginTop: 2 }}>
          {stmt.transactionCount ?? 0} transactions
        </div>
      </div>

      {/* Right: download buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onExcel(stmt)}
          disabled={isExcelLoading || isCSVLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isExcelLoading ? 'rgba(201,168,76,0.5)' : 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            color: '#080C14',
            fontWeight: 600,
            fontSize: '0.82rem',
            padding: '8px 18px',
            borderRadius: 50,
            border: 'none',
            cursor: isExcelLoading ? 'not-allowed' : 'pointer',
            opacity: isExcelLoading ? 0.7 : 1,
            transition: 'opacity 150ms ease',
            whiteSpace: 'nowrap',
          }}
        >
          <DownloadIcon />
          {isExcelLoading ? 'Downloading…' : 'Excel'}
        </button>

        <button
          onClick={() => onCSV(stmt)}
          disabled={isExcelLoading || isCSVLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            color: '#C9A84C',
            fontWeight: 600,
            fontSize: '0.82rem',
            padding: '8px 18px',
            borderRadius: 50,
            border: '1px solid rgba(201,168,76,0.3)',
            cursor: isCSVLoading ? 'not-allowed' : 'pointer',
            opacity: isCSVLoading ? 0.7 : 1,
            transition: 'opacity 150ms ease',
            whiteSpace: 'nowrap',
          }}
        >
          <DownloadIcon />
          {isCSVLoading ? 'Downloading…' : 'CSV'}
        </button>
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ExportPage() {
  const { data: session } = useSession();
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState(false);

  useEffect(() => {
    fetch('/api/statements')
      .then(r => r.json())
      .then(data => {
        setStatements(data.statements || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleDownloadExcel(stmt) {
    if ((session?.user?.plan || 'FREE') === 'FREE') {
      setUpgradeModal(true);
      return;
    }
    setDownloading(stmt.id + '_excel');
    try {
      const res = await fetch(`/api/statements/${stmt.id}`);
      const { statement } = await res.json();
      const raw = statement.rawData;

      const dlRes = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: raw.transactions || [],
          realIncome: raw.realIncome,
          realSpending: raw.realSpending,
          vatSummary: raw.vatSummary,
          bankName: statement.bankName,
        }),
      });

      const blob = await dlRes.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StatementFlow_${statement.bankName || 'Statement'}_${statement.dateFrom || 'export'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel download failed:', err);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadCSV(stmt) {
    setDownloading(stmt.id + '_csv');
    try {
      const res = await fetch(`/api/statements/${stmt.id}`);
      const { statement } = await res.json();
      const txs = statement.rawData?.transactions || [];

      const header = 'Date,Merchant,Category,Type,Amount\n';
      const rows = txs.map(t =>
        [
          t.dateFormatted || t.date,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.category || '',
          t.type || '',
          t.amount || 0,
        ].join(',')
      ).join('\n');

      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `StatementFlow_${statement.bankName || 'Statement'}_${statement.dateFrom || 'export'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV download failed:', err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <DashboardLayout title="Export">
      <style>{`
        @keyframes sf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {upgradeModal && <UpgradeModal feature="excel" onClose={() => setUpgradeModal(false)} />}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Export
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          Download your statements as Excel or CSV
        </p>
      </div>

      {/* Loading */}
      {loading && <SkeletonRows />}

      {/* Empty state */}
      {!loading && !statements.length && <EmptyState />}

      {/* Export list */}
      {!loading && statements.length > 0 && (
        <div style={{
          background: '#0D1117',
          border: '1px solid rgba(201,168,76,0.12)',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          {statements.map((stmt, idx) => (
            <StatementExportRow
              key={stmt.id || idx}
              stmt={stmt}
              isLast={idx === statements.length - 1}
              downloading={downloading}
              onExcel={handleDownloadExcel}
              onCSV={handleDownloadCSV}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
