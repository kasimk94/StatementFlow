'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const CAT_COLORS = {
  'Groceries': '#16a34a',
  'Eating Out': '#ea580c',
  'Online Shopping': '#ca8a04',
  'Travel & Transport': '#2563eb',
  'Household Bills': '#475569',
  'Direct Debits': '#4f46e5',
  'Entertainment & Leisure': '#7c3aed',
  'Health & Fitness': '#0d9488',
  'Transfers Received': '#059669',
  'Transfers Sent': '#dc2626',
  'Refunds': '#0891b2',
  'Finance & Bills': '#1d4ed8',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function catColor(cat) {
  return CAT_COLORS[cat] || '#8A9BB5';
}

// ─── Shared select style ──────────────────────────────────────────────────────

const selectStyle = {
  background: '#0D1117',
  border: '1px solid rgba(201,168,76,0.15)',
  color: '#F5F0E8',
  padding: '10px 14px',
  borderRadius: 10,
  fontSize: '0.875rem',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  WebkitAppearance: 'none',
};

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 48,
            background: '#0D1117',
            borderBottom: '1px solid rgba(201,168,76,0.06)',
            animation: 'sf-pulse 1.6s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [page, setPage] = useState(1);

  // Focused state for search input gold border
  const [searchFocused, setSearchFocused] = useState(false);

  // Hover states for pagination buttons
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const listRes = await fetch('/api/statements');
        const { statements: list } = await listRes.json();
        if (!list || list.length === 0) {
          setStatements([]);
          setLoading(false);
          return;
        }
        const detailed = await Promise.all(
          list.slice(0, 10).map((s) =>
            fetch(`/api/statements/${s.id}`)
              .then((r) => r.json())
              .then((d) => d.statement)
          )
        );
        setStatements(detailed.filter(Boolean));
      } catch {
        setStatements([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, typeFilter, bankFilter]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allTransactions = useMemo(() => {
    return statements
      .flatMap((stmt) =>
        (stmt.rawData?.transactions || []).map((t) => ({
          ...t,
          bankName: stmt.bankName || 'Unknown',
          statementId: stmt.id,
        }))
      )
      .sort(
        (a, b) =>
          new Date(b.dateFormatted || b.date) - new Date(a.dateFormatted || a.date)
      );
  }, [statements]);

  const categories = useMemo(
    () => [...new Set(allTransactions.map((t) => t.category).filter(Boolean))].sort(),
    [allTransactions]
  );

  const banks = useMemo(
    () => [...new Set(allTransactions.map((t) => t.bankName).filter(Boolean))].sort(),
    [allTransactions]
  );

  const filtered = useMemo(() => {
    return allTransactions.filter((t) => {
      if (search && !(t.description || '').toLowerCase().includes(search.toLowerCase()))
        return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (bankFilter && t.bankName !== bankFilter) return false;
      return true;
    });
  }, [allTransactions, search, categoryFilter, typeFilter, bankFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const anyFilterActive = !!(search || categoryFilter || typeFilter || bankFilter);

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    setTypeFilter('');
    setBankFilter('');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Transactions">
      <style>{`
        @keyframes sf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sf-tx-row:hover td {
          background: rgba(201,168,76,0.03) !important;
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 4 }}>
        <h1
          style={{
            color: '#F5F0E8',
            fontSize: '1.8rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Transactions
        </h1>
        <p style={{ color: '#8A9BB5', marginTop: 4, marginBottom: 0, fontSize: '0.9rem' }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 24,
          marginTop: 20,
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search merchants…"
          style={{
            flex: 1,
            minWidth: 200,
            background: '#0D1117',
            border: searchFocused
              ? '1px solid rgba(201,168,76,0.6)'
              : '1px solid rgba(201,168,76,0.15)',
            color: '#F5F0E8',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: '0.875rem',
            outline: 'none',
            transition: 'border-color 150ms ease',
          }}
        />

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ ...selectStyle, minWidth: 160 }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">All types</option>
          <option value="credit">Credits</option>
          <option value="debit">Debits</option>
        </select>

        {/* Bank */}
        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          style={{ ...selectStyle, minWidth: 140 }}
        >
          <option value="">All banks</option>
          {banks.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Clear button */}
        {anyFilterActive && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#C9A84C',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '10px 4px',
              outline: 'none',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && <SkeletonRows />}

      {/* ── No statements at all ── */}
      {!loading && statements.length === 0 && (
        <div
          style={{
            paddingTop: 60,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <p style={{ color: '#8A9BB5', fontSize: '0.95rem', margin: 0 }}>
            No statements found. Upload one to get started.
          </p>
          <Link
            href="/statements"
            style={{
              display: 'inline-block',
              padding: '11px 24px',
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#080C14',
              fontWeight: 700,
              fontSize: '0.9rem',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            My Statements
          </Link>
        </div>
      )}

      {/* ── No matches after filtering ── */}
      {!loading && statements.length > 0 && filtered.length === 0 && (
        <div
          style={{
            paddingTop: 60,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <p style={{ color: '#8A9BB5', fontSize: '0.95rem', margin: 0 }}>
            No transactions match your filters.
          </p>
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: '1px solid rgba(201,168,76,0.3)',
              color: '#C9A84C',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '10px 20px',
              borderRadius: 10,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Transactions table ── */}
      {!loading && filtered.length > 0 && (
        <>
          <div
            style={{
              background: '#0D1117',
              borderRadius: 16,
              border: '1px solid rgba(201,168,76,0.12)',
              overflow: 'hidden',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'auto',
              }}
            >
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.05)' }}>
                  {['Date', 'Merchant', 'Category', 'Amount', 'Bank', 'Type'].map((col) => (
                    <th
                      key={col}
                      style={{
                        color: '#8A9BB5',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '12px 16px',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paginated.map((t, idx) => {
                  const isCredit = t.type === 'credit';
                  const isEven = idx % 2 === 0;
                  const color = catColor(t.category);

                  return (
                    <tr
                      key={`${t.statementId}-${idx}`}
                      className="sf-tx-row"
                      style={{
                        borderBottom: '1px solid rgba(30,42,58,0.5)',
                      }}
                    >
                      {/* Date */}
                      <td
                        style={{
                          padding: '11px 16px',
                          color: '#8A9BB5',
                          fontSize: '0.82rem',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          background: isEven ? 'rgba(8,12,20,0.4)' : 'transparent',
                        }}
                      >
                        {fmtDate(t.dateFormatted || t.date)}
                      </td>

                      {/* Merchant */}
                      <td
                        style={{
                          padding: '11px 16px',
                          color: '#F5F0E8',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          background: isEven ? 'rgba(8,12,20,0.4)' : 'transparent',
                        }}
                      >
                        {t.description || t.merchant || '—'}
                      </td>

                      {/* Category badge */}
                      <td
                        style={{
                          padding: '11px 16px',
                          background: isEven ? 'rgba(8,12,20,0.4)' : 'transparent',
                        }}
                      >
                        {t.category ? (
                          <span
                            style={{
                              color: color,
                              background: color + '22',
                              borderRadius: 99,
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                          >
                            {t.category}
                          </span>
                        ) : (
                          <span style={{ color: '#8A9BB5', fontSize: '0.82rem' }}>—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td
                        style={{
                          padding: '11px 16px',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          color: isCredit ? '#00D4A0' : '#EF4444',
                          whiteSpace: 'nowrap',
                          background: isEven ? 'rgba(8,12,20,0.4)' : 'transparent',
                        }}
                      >
                        {isCredit ? '+' : '-'}
                        {fmt(Math.abs(t.amount ?? 0))}
                      </td>

                      {/* Bank */}
                      <td
                        style={{
                          padding: '11px 16px',
                          color: '#8A9BB5',
                          fontSize: '0.78rem',
                          whiteSpace: 'nowrap',
                          background: isEven ? 'rgba(8,12,20,0.4)' : 'transparent',
                        }}
                      >
                        {t.bankName || '—'}
                      </td>

                      {/* Type badge */}
                      <td
                        style={{
                          padding: '11px 16px',
                          background: isEven ? 'rgba(8,12,20,0.4)' : 'transparent',
                        }}
                      >
                        <span
                          style={{
                            background: isCredit
                              ? 'rgba(0,212,160,0.1)'
                              : 'rgba(239,68,68,0.1)',
                            color: isCredit ? '#00D4A0' : '#EF4444',
                            borderRadius: 99,
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-block',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.type || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                onMouseEnter={() => setPrevHovered(true)}
                onMouseLeave={() => setPrevHovered(false)}
                style={{
                  background: '#0D1117',
                  border: `1px solid ${prevHovered && page !== 1 ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.2)'}`,
                  color: '#F5F0E8',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1,
                  fontSize: '0.875rem',
                  transition: 'border-color 150ms ease',
                  outline: 'none',
                }}
              >
                Prev
              </button>

              <span style={{ color: '#8A9BB5', fontSize: '0.875rem' }}>
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                onMouseEnter={() => setNextHovered(true)}
                onMouseLeave={() => setNextHovered(false)}
                style={{
                  background: '#0D1117',
                  border: `1px solid ${nextHovered && page !== totalPages ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.2)'}`,
                  color: '#F5F0E8',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.4 : 1,
                  fontSize: '0.875rem',
                  transition: 'border-color 150ms ease',
                  outline: 'none',
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
