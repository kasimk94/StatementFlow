'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

// ─── Category Definitions ─────────────────────────────────────────────────────

const FIXED_CATEGORIES = [
  { id: 'housing',   label: 'Housing / Rent',      color: '#b45309' },
  { id: 'utilities', label: 'Utilities',            color: '#475569' },
  { id: 'internet',  label: 'Internet & Mobile',    color: '#2563eb' },
  { id: 'council',   label: 'Council Tax',          color: '#4f46e5' },
  { id: 'insurance', label: 'Insurance',            color: '#0d9488' },
  { id: 'loans',     label: 'Loan / Credit Card',   color: '#dc2626' },
  { id: 'childcare', label: 'Childcare',            color: '#7c3aed' },
];

const VARIABLE_CATEGORIES = [
  { id: 'groceries',     label: 'Groceries',            color: '#16a34a' },
  { id: 'eating_out',    label: 'Eating Out & Takeaway', color: '#ea580c' },
  { id: 'transport',     label: 'Transport',             color: '#2563eb' },
  { id: 'fuel',          label: 'Fuel',                  color: '#ca8a04' },
  { id: 'shopping',      label: 'Shopping',              color: '#db2777' },
  { id: 'entertainment', label: 'Entertainment',         color: '#7c3aed' },
  { id: 'subscriptions', label: 'Subscriptions',         color: '#a855f7' },
  { id: 'personal_care', label: 'Personal Care',         color: '#ec4899' },
  { id: 'savings',       label: 'Savings',               color: '#059669' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n ?? 0);
}
function fmtFull(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

function sectionTotal(cats, budgets) {
  return cats.reduce((s, c) => s + (parseFloat(budgets[c.id]) || 0), 0);
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 72, stroke = 6, color = '#C9A84C' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function IncomeCard({ income, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(income);
  const inputRef = useRef(null);

  useEffect(() => { setVal(income); }, [income]);

  function startEdit() {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    onSave(val);
  }

  const num = parseFloat(val) || 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,212,160,0.06) 0%, rgba(0,212,160,0.02) 100%)',
      border: '1px solid rgba(0,212,160,0.18)',
      borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 0,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        background: 'radial-gradient(circle, rgba(0,212,160,0.12) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#00D4A0',
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Monthly Income
      </div>

      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#8A9BB5', fontSize: '1.4rem', fontWeight: 300 }}>£</span>
          <input
            ref={inputRef}
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === 'Enter' && commit()}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid #C9A84C',
              color: '#F5F0E8',
              fontSize: '2rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              outline: 'none',
              width: '100%',
              padding: '2px 0',
            }}
            placeholder="0"
          />
        </div>
      ) : (
        <>
          {num > 0 ? (
            <div
              onClick={startEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 4 }}
              title="Click to edit"
            >
              <span style={{ color: '#F5F0E8', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {fmt(num)}
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A9BB5"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          ) : (
            <div
              onClick={startEdit}
              style={{
                display: 'inline-flex', alignItems: 'center',
                background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                color: '#C9A84C', padding: '8px 16px', borderRadius: 8,
                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                marginBottom: 4, transition: 'all 150ms ease',
              }}
            >
              Click to set income
            </div>
          )}
        </>

    </div>
  );
}

function BudgetedCard({ totalBudgeted, incomeNum }) {
  const allocPct = incomeNum > 0 ? Math.round((totalBudgeted / incomeNum) * 100) : 0;
  const ringColor = allocPct > 100 ? '#EF4444' : allocPct > 80 ? '#F59E0B' : '#C9A84C';

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.02) 100%)',
      border: '1px solid rgba(201,168,76,0.18)',
      borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 0,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        background: 'radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#C9A84C',
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Budgeted This Month
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: '#F5F0E8', fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {fmt(totalBudgeted)}
          </div>
          <div style={{ color: '#8A9BB5', fontSize: '0.8rem', marginTop: 6 }}>
            {incomeNum > 0 ? `${allocPct}% of income allocated` : 'Set income to see %'}
          </div>
        </div>
        {incomeNum > 0 ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ProgressRing pct={allocPct} size={68} stroke={5} color={ringColor} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: ringColor,
            }}>
              {allocPct}%
            </div>
          </div>
        ) : (
          <span style={{ color: 'rgba(138,155,181,0.4)', fontSize: '2rem', fontWeight: 300 }}>—</span>
        )}
      </div>
    </div>
  );
}

function RemainingCard({ remaining, incomeNum }) {
  const isPositive = remaining >= 0;
  const color = isPositive ? '#00D4A0' : '#EF4444';
  const borderColor = isPositive ? 'rgba(0,212,160,0.18)' : 'rgba(239,68,68,0.18)';
  const bgGrad = isPositive
    ? 'linear-gradient(135deg, rgba(0,212,160,0.06) 0%, rgba(0,212,160,0.02) 100%)'
    : 'linear-gradient(135deg, rgba(239,68,68,0.07) 0%, rgba(239,68,68,0.02) 100%)';
  const glowColor = isPositive ? 'rgba(0,212,160,0.12)' : 'rgba(239,68,68,0.1)';

  return (
    <div style={{
      background: bgGrad,
      border: `1px solid ${borderColor}`,
      borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 0,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ fontSize: '0.72rem', fontWeight: 600, color,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Left to Allocate
      </div>

      {incomeNum > 0 ? (
        <>
          <div style={{ color, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {fmt(Math.abs(remaining))}
          </div>
          <div style={{ color: '#8A9BB5', fontSize: '0.8rem', marginTop: 6 }}>
            {isPositive ? 'available to allocate' : 'over your income'}
          </div>
        </>
      ) : (
        <span style={{ color: 'rgba(138,155,181,0.4)', fontSize: '2rem', fontWeight: 300 }}>—</span>
      )}
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ cat, budget, actual, hasStatements, onChange, onBlur }) {
  const [focused, setFocused] = useState(false);
  const budgetNum = parseFloat(budget) || 0;
  const actualNum = actual || 0;
  const hasBudget = budgetNum > 0;
  const pct = hasBudget ? Math.min((actualNum / budgetNum) * 100, 100) : 0;
  const rawPct = hasBudget ? (actualNum / budgetNum) * 100 : 0;
  const isOver = rawPct > 100;
  const isWarn = rawPct >= 70 && rawPct <= 100;
  const barColor = isOver ? '#EF4444' : isWarn ? '#F59E0B' : '#00D4A0';

  return (
    <div style={{
      background: '#0D1117',
      border: `1px solid ${focused ? 'rgba(201,168,76,0.25)' : 'rgba(201,168,76,0.1)'}`,
      borderRadius: 12,
      padding: '20px 20px',
      marginBottom: 6,
      transition: 'border-color 150ms ease',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Left — dot + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%',
            background: cat.color, flexShrink: 0, boxShadow: `0 0 6px ${cat.color}66` }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat.label}
            </div>
            {hasStatements && actualNum > 0 && (
              <div style={{ color: '#8A9BB5', fontSize: '0.72rem', marginTop: 2 }}>
                Spent {fmtFull(actualNum)} last statement
              </div>
            )}
          </div>
        </div>

        {/* Right — input with £ prefix */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'rgba(201,168,76,0.06)',
          border: `1px solid ${isOver && hasBudget ? 'rgba(239,68,68,0.5)' : focused ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.25)'}`,
          borderRadius: 10,
          boxShadow: focused ? '0 0 0 2px rgba(201,168,76,0.2)' : 'none',
          transition: 'all 150ms ease', flexShrink: 0,
          width: 140, overflow: 'hidden',
        }}>
          <span style={{
            color: '#C9A84C', fontSize: '0.9rem', fontWeight: 600,
            paddingLeft: 12, paddingRight: 4, userSelect: 'none',
          }}>£</span>
          <input
            type="number"
            value={budget}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); onBlur(); }}
            placeholder="0"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#F5F0E8', fontSize: '1rem', fontWeight: 500,
              flex: 1, padding: '10px 12px 10px 0', textAlign: 'right',
            }}
          />
        </div>
      </div>

      {/* Progress bar — only shown when budget is set */}
      {hasBudget && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)',
            borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              width: pct + '%', height: '100%',
              background: barColor,
              borderRadius: 999,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: `0 0 8px ${barColor}55`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            <span style={{ color: isOver ? '#EF4444' : '#8A9BB5', fontSize: '0.72rem' }}>
              {hasStatements && actualNum > 0
                ? isOver
                  ? `${fmtFull(actualNum - budgetNum)} over budget`
                  : `${fmtFull(actualNum)} spent`
                : 'No statement data yet'}
            </span>
            <span style={{ color: '#8A9BB5', fontSize: '0.72rem' }}>{fmt(budgetNum)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Category Inline ──────────────────────────────────────────────────────

function AddCategoryButton({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const inputRef = useRef(null);

  function submit() {
    const trimmed = label.trim();
    if (trimmed) {
      onAdd(trimmed);
      setLabel('');
    }
    setOpen(false);
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none', border: 'none', color: '#C9A84C',
          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 4px', opacity: 0.7, transition: 'opacity 150ms ease',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add category
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
      <input
        ref={inputRef}
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Category name…"
        style={{
          flex: 1, background: '#0D1117',
          border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: 8, padding: '8px 12px',
          color: '#F5F0E8', fontSize: '0.875rem', outline: 'none',
        }}
      />
      <button onClick={submit} style={{
        background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
        color: '#080C14', border: 'none', borderRadius: 8,
        padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem',
      }}>Add</button>
      <button onClick={() => setOpen(false)} style={{
        background: 'transparent', border: 'none', color: '#8A9BB5',
        cursor: 'pointer', padding: '8px 6px', fontSize: '0.82rem',
      }}>Cancel</button>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ show }) {
  return (
    <div style={{
      position: 'fixed', bottom: 88, right: 24, zIndex: 9998,
      background: '#0D1117', border: '1px solid rgba(0,212,160,0.3)',
      borderRadius: 12, padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transform: show ? 'translateY(0)' : 'translateY(16px)',
      opacity: show ? 1 : 0,
      transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      pointerEvents: 'none',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4A0"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
      <span style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 600 }}>
        Budget saved ✓
      </span>
    </div>
  );
}

// ─── Floating Save Button ─────────────────────────────────────────────────────

function FloatingSaveButton({ visible, onSave }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      transform: visible ? 'translateY(0) scale(1)' : 'translateY(80px) scale(0.9)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <button
        onClick={onSave}
        style={{
          background: 'linear-gradient(135deg, #C9A84C 0%, #E8C97A 50%, #C9A84C 100%)',
          color: '#080C14', border: 'none', borderRadius: 50,
          padding: '13px 28px', fontSize: '0.95rem', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 32px rgba(201,168,76,0.45), 0 0 0 1px rgba(201,168,76,0.2)',
          letterSpacing: '-0.01em',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
        Save changes
      </button>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, cats, budgets }) {
  const total = sectionTotal(cats, budgets);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 10, marginTop: 28,
    }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8A9BB5',
        letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {title}
      </span>
      {total > 0 && (
        <span style={{ fontSize: '0.78rem', color: '#C9A84C', fontWeight: 600 }}>
          {fmt(total)} / month
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [income,          setIncome]          = useState('');
  const [budgets,         setBudgets]         = useState({});
  const [actuals,         setActuals]         = useState({});
  const [hasStatements,   setHasStatements]   = useState(false);
  const [customFixed,     setCustomFixed]     = useState([]);
  const [customVariable,  setCustomVariable]  = useState([]);
  const [unsaved,         setUnsaved]         = useState(false);
  const [showToast,       setShowToast]       = useState(false);
  const [loading,         setLoading]         = useState(true);
  const isFirstLoad = useRef(true);

  // ── Build actuals from categoryBreakdown ──────────────────────────────────
  function buildActuals(catBreakdown) {
    const map = {};
    const m = (key, id) => { if (catBreakdown?.[key]) map[id] = catBreakdown[key].total || 0; };
    m('Groceries',               'groceries');
    m('Eating Out',              'eating_out');
    m('Travel & Transport',      'transport');
    m('Entertainment & Leisure', 'entertainment');
    m('Direct Debits',           'subscriptions');
    m('Household Bills',         'utilities');
    m('Finance & Bills',         'loans');
    m('Rent & Mortgage',         'housing');
    m('Online Shopping',         'shopping');
    m('High Street',             'shopping'); // merge into shopping
    setActuals(prev => ({ ...prev, ...map }));
  }

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sf_budget');
      if (saved) {
        const b = JSON.parse(saved);
        setIncome(b.income || '');
        setBudgets(b.categories || {});
        setCustomFixed(b.customFixed || []);
        setCustomVariable(b.customVariable || []);
      }
    } catch (_) {}

    fetch('/api/statements')
      .then(r => r.json())
      .then(async ({ statements: list }) => {
        if (list && list.length > 0) {
          setHasStatements(true);
          try {
            const detail = await fetch('/api/statements/' + list[0].id).then(r => r.json());
            if (detail.statement?.rawData?.categoryBreakdown) {
              buildActuals(detail.statement.rawData.categoryBreakdown);
            }
          } catch (_) {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Mark unsaved when data changes (skip first render) ────────────────────
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    setUnsaved(true);
  }, [budgets, income, customFixed, customVariable]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const save = useCallback(() => {
    try {
      localStorage.setItem('sf_budget', JSON.stringify({
        income, categories: budgets, customFixed, customVariable,
      }));
    } catch (_) {}
    setUnsaved(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  }, [income, budgets, customFixed, customVariable]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const allFixed    = useMemo(() => [...FIXED_CATEGORIES,    ...customFixed],    [customFixed]);
  const allVariable = useMemo(() => [...VARIABLE_CATEGORIES, ...customVariable], [customVariable]);

  const totalBudgeted = useMemo(() =>
    [...allFixed, ...allVariable].reduce((s, c) => s + (parseFloat(budgets[c.id]) || 0), 0),
    [allFixed, allVariable, budgets]
  );

  const incomeNum = parseFloat(income) || 0;
  const remaining = incomeNum - totalBudgeted;

  function setBudgetFor(id, val) {
    setBudgets(prev => ({ ...prev, [id]: val }));
  }

  function addCustomCategory(section, label) {
    const id = 'custom_' + Date.now();
    const colors = ['#6366f1','#14b8a6','#f97316','#84cc16','#e879f9','#22d3ee'];
    const color  = colors[Math.floor(Math.random() * colors.length)];
    const cat = { id, label, color };
    if (section === 'fixed') setCustomFixed(p => [...p, cat]);
    else setCustomVariable(p => [...p, cat]);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout title="Budget">
        <style>{`@keyframes sf-pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex: 1, height: 130, background: '#0D1117',
              border: '1px solid rgba(201,168,76,0.1)', borderRadius: 16,
              animation: 'sf-pulse 1.6s ease-in-out infinite',
              animationDelay: i * 0.12 + 's' }} />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 72, background: '#0D1117',
            border: '1px solid rgba(201,168,76,0.08)', borderRadius: 12,
            marginBottom: 6, animation: 'sf-pulse 1.6s ease-in-out infinite',
            animationDelay: i * 0.08 + 's' }} />
        ))}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Budget">
      <style>{`
        @keyframes sf-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700,
          margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Budget
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          Set monthly spending limits by category
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{
        display: 'flex', gap: 14, marginBottom: 40, flexWrap: 'wrap',
      }}>
        <IncomeCard income={income} onSave={v => setIncome(v)} />
        <BudgetedCard totalBudgeted={totalBudgeted} incomeNum={incomeNum} />
        <RemainingCard remaining={remaining} incomeNum={incomeNum} />
      </div>

      {/* No statements notice */}
      {!hasStatements && (
        <div style={{
          background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)',
          borderRadius: 12, padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <span style={{ color: '#8A9BB5', fontSize: '0.875rem' }}>
            Upload a statement to see your actual spend vs budget
          </span>
          <a href="/statements" style={{
            color: '#C9A84C', fontWeight: 600, fontSize: '0.82rem',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            Upload Statement
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12,5 19,12 12,19"/>
            </svg>
          </a>
        </div>
      )}

      {/* ── Fixed Costs ── */}
      <SectionHeader title="Fixed Costs" cats={allFixed} budgets={budgets} />
      {allFixed.map(cat => (
        <CategoryCard
          key={cat.id}
          cat={cat}
          budget={budgets[cat.id] || ''}
          actual={actuals[cat.id]}
          hasStatements={hasStatements}
          onChange={v => setBudgetFor(cat.id, v)}
          onBlur={save}
        />
      ))}
      <AddCategoryButton onAdd={label => addCustomCategory('fixed', label)} />

      {/* ── Variable Costs ── */}
      <div style={{ marginTop: 40 }} />
      <SectionHeader title="Variable Costs" cats={allVariable} budgets={budgets} />
      {allVariable.map(cat => (
        <CategoryCard
          key={cat.id}
          cat={cat}
          budget={budgets[cat.id] || ''}
          actual={actuals[cat.id]}
          hasStatements={hasStatements}
          onChange={v => setBudgetFor(cat.id, v)}
          onBlur={save}
        />
      ))}
      <AddCategoryButton onAdd={label => addCustomCategory('variable', label)} />

      {/* Bottom padding for floating button */}
      <div style={{ height: 80 }} />

      </div>{/* end max-width wrapper */}

      {/* Floating save + toast */}
      <FloatingSaveButton visible={unsaved} onSave={save} />
      <Toast show={showToast} />
    </DashboardLayout>
  );
}
