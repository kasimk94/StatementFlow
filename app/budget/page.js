'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

// ─── Category definitions ─────────────────────────────────────────────────────

const FIXED = [
  { id: 'housing',   emoji: '🏠', label: 'Housing / Rent',    max: 3000 },
  { id: 'utilities', emoji: '⚡', label: 'Utilities',          max: 500  },
  { id: 'internet',  emoji: '📱', label: 'Internet & Mobile',  max: 200  },
  { id: 'council',   emoji: '🏛️', label: 'Council Tax',        max: 500  },
  { id: 'insurance', emoji: '🛡️', label: 'Insurance',          max: 500  },
  { id: 'loans',     emoji: '💳', label: 'Loan / Credit Card', max: 2000 },
  { id: 'childcare', emoji: '👶', label: 'Childcare',          max: 2000 },
];

const VARIABLE = [
  { id: 'groceries',     emoji: '🛒', label: 'Groceries',             max: 800  },
  { id: 'eating_out',    emoji: '🍔', label: 'Eating Out & Takeaway', max: 600  },
  { id: 'transport',     emoji: '🚗', label: 'Transport',             max: 500  },
  { id: 'fuel',          emoji: '⛽', label: 'Fuel',                  max: 400  },
  { id: 'shopping',      emoji: '🛍️', label: 'Shopping',              max: 600  },
  { id: 'entertainment', emoji: '🎬', label: 'Entertainment',         max: 400  },
  { id: 'subscriptions', emoji: '📺', label: 'Subscriptions',         max: 200  },
  { id: 'personal_care', emoji: '💆', label: 'Personal Care',         max: 300  },
  { id: 'savings',       emoji: '💰', label: 'Savings',               max: 2000 },
];

const PICKER_EMOJIS = [
  '🏠','🛒','🚗','🍔','🎬','📱','💊','✈️','🐾','🎓',
  '💻','🎮','🏋️','☕','🌊','🎵','👕','💄','🏥','📚',
  '🎁','🍷','🐕','🚴',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function fmtFull(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

function sectionTotal(cats, budgets) {
  return cats.reduce((s, c) => s + (Number(budgets[c.id]) || 0), 0);
}

function calcHealthScore(incomeNum, allCats, budgets, totalBudgeted) {
  let score = 0;
  if (incomeNum > 0) score += 20;
  const filled = allCats.filter(c => (Number(budgets[c.id]) || 0) > 0).length;
  score += Math.min(filled, 12) * 5;
  if (incomeNum > 0) {
    const pct = (totalBudgeted / incomeNum) * 100;
    if (pct >= 70 && pct <= 100) score += 20;
    else if (pct >= 50 && pct < 70) score += 10;
  }
  return Math.min(score, 100);
}

function scoreInfo(s) {
  if (s >= 71) return { label: 'Good', color: '#10B981' };
  if (s >= 41) return { label: 'Fair', color: '#F59E0B' };
  return { label: 'Needs Work', color: '#EF4444' };
}

// ─── Donut arc chart ──────────────────────────────────────────────────────────

function DonutChart({ pct }) {
  const size = 220;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const capped = Math.min(pct, 100);
  const offset = circ - (capped / 100) * circ;
  const isOver = pct > 100;

  return (
    <div style={{
      position: 'relative', width: size, height: size, flexShrink: 0,
      filter: 'drop-shadow(0 0 20px rgba(201,168,76,0.2))',
    }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#E8C97A" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={isOver ? '#EF4444' : 'url(#donutGrad)'}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.3s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          color: isOver ? '#EF4444' : '#F5F0E8',
          fontSize: '2.8rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em',
        }}>
          {Math.round(pct)}%
        </span>
        <span style={{ color: '#8A9BB5', fontSize: '0.85rem', marginTop: 5 }}>allocated</span>
      </div>
    </div>
  );
}

// ─── Health score ─────────────────────────────────────────────────────────────

function HealthScore({ score, incomeNum }) {
  const notStarted = incomeNum === 0;
  const { label, color } = notStarted
    ? { label: 'Set income to begin', color: '#8A9BB5' }
    : scoreInfo(score);
  const barWidth = notStarted ? 0 : score;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: 'rgba(201,168,76,0.06)',
      border: '1px solid rgba(201,168,76,0.2)',
      borderRadius: 16, padding: 24,
      minWidth: 150, flex: 1,
    }}>
      <span style={{
        fontSize: '0.65rem', fontWeight: 700, color: '#8A9BB5',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Budget Health
      </span>
      <span style={{
        fontSize: '3.5rem', fontWeight: 800, color: '#C9A84C',
        lineHeight: 1, letterSpacing: '-0.04em',
      }}>
        {notStarted ? '—' : score}
      </span>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color }}>
        {label}
      </span>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
        <div style={{
          width: barWidth + '%', height: '100%',
          background: notStarted ? 'transparent' : color,
          borderRadius: 999,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: notStarted ? 'none' : ('0 0 8px ' + color + '88'),
        }} />
      </div>
    </div>
  );
}

// ─── Editable income stat ─────────────────────────────────────────────────────

function EditableIncomeStat({ incomeNum, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);

  function startEdit() {
    setDraft(incomeNum > 0 ? String(incomeNum) : '');
    setEditing(true);
    setTimeout(() => ref.current && ref.current.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) onSave(n);
  }

  return (
    <div
      onClick={!editing ? startEdit : undefined}
      style={{
        flex: 1, textAlign: 'center', cursor: 'pointer',
        padding: '16px 12px', borderRadius: 10,
        transition: 'background 150ms',
      }}
    >
      <div style={{
        fontSize: '0.75rem', color: '#8A9BB5', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        💰 Monthly Income
      </div>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <span style={{ color: '#C9A84C', fontSize: '1.1rem', fontWeight: 700 }}>£</span>
          <input
            ref={ref}
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            style={{
              background: 'transparent', border: 'none',
              borderBottom: '2px solid #C9A84C',
              color: '#C9A84C', fontSize: '1.2rem', fontWeight: 700,
              outline: 'none', width: 80, textAlign: 'center', padding: '2px 0',
            }}
          />
        </div>
      ) : (
        <div className="sf-income-val" style={{
          fontSize: '1.3rem', fontWeight: 700,
          color: incomeNum > 0 ? '#C9A84C' : '#8A9BB5',
          letterSpacing: '-0.02em',
        }}>
          {incomeNum > 0 ? fmt(incomeNum) : 'Not set'}
        </div>
      )}
    </div>
  );
}

// ─── Right-side summary row ───────────────────────────────────────────────────

function SummaryRow({ emoji, label, budgeted, incomeNum }) {
  const pct = budgeted > 0 && incomeNum > 0 ? Math.min((budgeted / incomeNum) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ color: '#8A9BB5', fontSize: '0.85rem' }}>{emoji} {label}</span>
        <span style={{ color: '#F5F0E8', fontSize: '0.95rem', fontWeight: 600 }}>{fmt(budgeted)}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: pct + '%', height: '100%',
          background: 'linear-gradient(90deg, #C9A84C, #E8C97A)',
          borderRadius: 999,
          transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroCard({
  incomeNum, totalBudgeted, totalFixed, totalVariable, totalSavings,
  allocPct, score, onSetIncome, onScrollToIncome,
}) {
  const remaining = incomeNum - totalBudgeted;
  const isOver = remaining < 0;

  return (
    <div style={{
      background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.15)',
      borderRadius: 20, padding: '40px 48px', marginBottom: 32,
    }}>
      {/* Top row: Donut | Health Score | Summary rows */}
      <div style={{ display: 'flex', gap: 36, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <DonutChart pct={allocPct} />
        </div>

        {/* Health score */}
        <HealthScore score={score} incomeNum={incomeNum} />

        {/* Summary rows + set income */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <SummaryRow emoji="🏠" label="Fixed Costs"    budgeted={totalFixed}    incomeNum={incomeNum} />
          <SummaryRow emoji="🔄" label="Variable Costs" budgeted={totalVariable} incomeNum={incomeNum} />
          <SummaryRow emoji="💾" label="Savings"        budgeted={totalSavings}  incomeNum={incomeNum} />
          {incomeNum === 0 && (
            <button
              onClick={onScrollToIncome}
              style={{
                marginTop: 16,
                background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
                color: '#080C14', border: 'none', borderRadius: 12,
                height: 48, fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer', width: '100%',
              }}
            >
              Set Monthly Income
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />

      {/* Mini stats row */}
      <div style={{ display: 'flex' }}>
        <EditableIncomeStat incomeNum={incomeNum} onSave={onSetIncome} />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch', margin: '0 4px' }} />
        <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px' }}>
          <div style={{
            fontSize: '0.75rem', color: '#8A9BB5', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            📊 Total Budgeted
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '-0.02em' }}>
            {fmt(totalBudgeted)}
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch', margin: '0 4px' }} />
        <div style={{ flex: 1, textAlign: 'center', padding: '16px 12px' }}>
          <div style={{
            fontSize: '0.75rem', color: '#8A9BB5', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            ✅ Left to Allocate
          </div>
          <div style={{
            fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em',
            color: incomeNum > 0 ? (isOver ? '#EF4444' : '#10B981') : '#8A9BB5',
          }}>
            {incomeNum > 0 ? fmt(Math.abs(remaining)) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Income prompt card ───────────────────────────────────────────────────────

function IncomePromptCard({ onSet }) {
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  function commit() {
    const n = parseFloat(val);
    if (n > 0) onSet(n);
  }

  return (
    <div style={{
      background: 'rgba(201,168,76,0.06)',
      border: '1px solid rgba(201,168,76,0.3)',
      borderRadius: 16, padding: 32, marginBottom: 32,
    }}>
      <div style={{ color: '#F5F0E8', fontSize: '1.2rem', fontWeight: 600, marginBottom: 6 }}>
        First, what&apos;s your monthly take-home pay?
      </div>
      <div style={{ color: '#8A9BB5', fontSize: '0.85rem', marginBottom: 20 }}>
        This helps us show how balanced your budget is
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(201,168,76,0.3)',
          borderRadius: 12, padding: '0 16px', flex: 1,
        }}>
          <span style={{ color: '#C9A84C', fontSize: '1.4rem', fontWeight: 300, marginRight: 6 }}>£</span>
          <input
            ref={inputRef}
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            placeholder="e.g. 2800"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#F5F0E8', fontSize: '1.4rem', fontWeight: 600,
              padding: '14px 0', width: '100%',
            }}
          />
        </div>
        <button
          onClick={commit}
          style={{
            background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            color: '#080C14', border: 'none', borderRadius: 12,
            padding: '14px 28px', fontWeight: 700, fontSize: '1rem',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          Set Income →
        </button>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ emoji, title, cats, budgets, incomeNum }) {
  const total = sectionTotal(cats, budgets);
  const remaining = incomeNum > 0 ? incomeNum - total : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0 12px',
      borderBottom: '1px solid rgba(201,168,76,0.2)',
      marginBottom: 12,
    }}>
      <span style={{ color: '#F5F0E8', fontSize: '1rem', fontWeight: 600 }}>
        {emoji} {title}
      </span>
      <span style={{ color: '#8A9BB5', fontSize: '0.8rem' }}>
        {fmt(total)} budgeted
        {remaining !== null && (
          <span style={{ color: remaining >= 0 ? '#10B981' : '#EF4444', marginLeft: 6 }}>
            · {fmt(Math.abs(remaining))} {remaining >= 0 ? 'remaining' : 'over'}
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Category card (with slider) ──────────────────────────────────────────────

function CategoryCard({ cat, budget, actual, hasStatements, onChange }) {
  const [editingAmount, setEditingAmount] = useState(false);
  const [draftAmount, setDraftAmount] = useState('');
  const [hovered, setHovered] = useState(false);
  const amountRef = useRef(null);

  const max = cat.max || 1000;
  const budgetNum = Number(budget) || 0;
  const actualNum = Number(actual) || 0;

  const fillPct = Math.min((budgetNum / max) * 100, 100);
  const sliderBg = `linear-gradient(to right, #C9A84C 0%, #C9A84C ${fillPct}%, rgba(255,255,255,0.08) ${fillPct}%, rgba(255,255,255,0.08) 100%)`;

  const hasBudget = budgetNum > 0;
  const hasActual = hasStatements && actualNum > 0;
  const spendPct = hasBudget && hasActual ? Math.min((actualNum / budgetNum) * 100, 100) : 0;
  const rawPct = hasBudget && hasActual ? (actualNum / budgetNum) * 100 : 0;
  const isOver = rawPct > 100;
  const isWarn = rawPct >= 70 && rawPct <= 100;
  const barColor = isOver ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';
  const pillText = isOver ? 'Over budget ✗' : isWarn ? 'On track' : 'Under budget ✓';
  const pillColor = isOver ? '#EF4444' : isWarn ? '#F59E0B' : '#10B981';

  function startEdit() {
    setDraftAmount(budgetNum > 0 ? String(budgetNum) : '');
    setEditingAmount(true);
    setTimeout(() => amountRef.current && amountRef.current.focus(), 0);
  }

  function commitAmount() {
    setEditingAmount(false);
    const n = parseFloat(draftAmount);
    if (!isNaN(n) && n >= 0) {
      onChange(Math.min(n, max));
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#0D1117',
        border: '1px solid ' + (hovered ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.1)'),
        borderRadius: 16, padding: '20px 24px', marginBottom: 10,
        transition: 'border-color 150ms ease',
      }}
    >
      {/* Top row: emoji + name | £amount */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ color: '#F5F0E8', fontSize: '1rem', fontWeight: 500 }}>
          {cat.emoji} {cat.label}
        </span>
        {editingAmount ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: '#C9A84C', fontWeight: 700, fontSize: '1.1rem' }}>£</span>
            <input
              ref={amountRef}
              type="number"
              value={draftAmount}
              onChange={e => setDraftAmount(e.target.value)}
              onBlur={commitAmount}
              onKeyDown={e => {
                if (e.key === 'Enter') commitAmount();
                if (e.key === 'Escape') setEditingAmount(false);
              }}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: '2px solid #C9A84C',
                color: '#F5F0E8', fontSize: '1.15rem', fontWeight: 700,
                outline: 'none', width: 80, textAlign: 'right', padding: '2px 0',
              }}
            />
          </div>
        ) : (
          <span
            onClick={startEdit}
            title="Click to type a value"
            style={{
              color: budgetNum > 0 ? '#C9A84C' : '#8A9BB5',
              fontSize: '1.1rem', fontWeight: 600,
              letterSpacing: '-0.02em', cursor: 'pointer',
            }}
          >
            {fmt(budgetNum)}
          </span>
        )}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={max}
        step={10}
        value={budgetNum}
        onChange={e => onChange(Number(e.target.value))}
        className="sf-slider"
        style={{ background: sliderBg }}
      />

      {/* Actuals row */}
      {hasActual && hasBudget && (
        <div style={{ marginTop: 14 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              width: spendPct + '%', height: '100%', background: barColor,
              borderRadius: 999,
              transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 0 6px ' + barColor + '66',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8A9BB5', fontSize: '0.72rem' }}>
              Spent last month: {fmtFull(actualNum)}
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, color: pillColor,
              background: pillColor + '1A', padding: '2px 9px',
              borderRadius: 999, border: '1px solid ' + pillColor + '44',
            }}>
              {pillText}
            </span>
          </div>
        </div>
      )}
      {hasActual && !hasBudget && (
        <div style={{ marginTop: 10 }}>
          <span style={{ color: '#8A9BB5', fontSize: '0.72rem' }}>
            Spent last month: {fmtFull(actualNum)} — drag slider to set a budget
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Add category form ────────────────────────────────────────────────────────

function AddCategoryForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('🏷️');
  const [label, setLabel] = useState('');
  const [maxVal, setMaxVal] = useState('500');
  const [pickerOpen, setPickerOpen] = useState(false);
  const labelRef = useRef(null);

  useEffect(() => {
    if (open && labelRef.current) labelRef.current.focus();
  }, [open]);

  function submit() {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd({ emoji: selectedEmoji, label: trimmed, max: parseInt(maxVal) || 500 });
    setSelectedEmoji('🏷️');
    setLabel('');
    setMaxVal('500');
    setOpen(false);
    setPickerOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: '1px dashed rgba(201,168,76,0.25)',
          color: '#C9A84C', fontSize: '0.82rem', fontWeight: 600,
          cursor: 'pointer', borderRadius: 12, padding: '11px 16px',
          width: '100%', marginTop: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: 0.7, transition: 'opacity 150ms, border-color 150ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)'; }}
      >
        + Add category
      </button>
    );
  }

  return (
    <div style={{
      background: '#0D1117', border: '1px solid rgba(201,168,76,0.2)',
      borderRadius: 14, padding: 16, marginTop: 4,
    }}>
      {/* Emoji picker toggle */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setPickerOpen(p => !p)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 12px',
            cursor: 'pointer', fontSize: '1.2rem', color: '#F5F0E8',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {selectedEmoji}
          <span style={{ fontSize: '0.65rem', color: '#8A9BB5' }}>▼</span>
        </button>
        {pickerOpen && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8,
            background: '#080C14', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: 10, maxWidth: 310,
          }}>
            {PICKER_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => { setSelectedEmoji(e); setPickerOpen(false); }}
                style={{
                  background: e === selectedEmoji ? 'rgba(201,168,76,0.2)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontSize: '1.2rem', padding: 5, borderRadius: 6,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Name + max + buttons */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={labelRef}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
          placeholder="Category name…"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 8, padding: '9px 12px',
            color: '#F5F0E8', fontSize: '0.875rem', outline: 'none',
          }}
        />
        <input
          type="number"
          value={maxVal}
          onChange={e => setMaxVal(e.target.value)}
          placeholder="Max £"
          title="Slider max value (£)"
          style={{
            width: 80, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(201,168,76,0.25)',
            borderRadius: 8, padding: '9px 10px',
            color: '#F5F0E8', fontSize: '0.875rem', outline: 'none',
          }}
        />
        <button
          onClick={submit}
          style={{
            background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            color: '#080C14', border: 'none', borderRadius: 8,
            padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
          }}
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent', border: 'none',
            color: '#8A9BB5', cursor: 'pointer', padding: '9px 6px', fontSize: '1rem',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Floating save bar ────────────────────────────────────────────────────────

function FloatingSaveBar({ visible, onSave, onDiscard }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
      background: '#0D1117',
      borderTop: '1px solid rgba(201,168,76,0.2)',
      padding: '16px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
    }}>
      <span style={{ color: '#8A9BB5', fontSize: '0.875rem' }}>
        You have unsaved changes
      </span>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onDiscard}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#8A9BB5', borderRadius: 10,
            padding: '9px 20px', fontWeight: 600,
            cursor: 'pointer', fontSize: '0.875rem',
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#F5F0E8'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#8A9BB5'; }}
        >
          Discard
        </button>
        <button
          onClick={onSave}
          style={{
            background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
            color: '#080C14', border: 'none', borderRadius: 10,
            padding: '9px 24px', fontWeight: 700,
            cursor: 'pointer', fontSize: '0.875rem',
          }}
        >
          Save Budget
        </button>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ show }) {
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.3)',
      borderRadius: 12, padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transform: show ? 'translateY(0)' : 'translateY(-20px)',
      opacity: show ? 1 : 0,
      transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      pointerEvents: 'none',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20,6 9,17 4,12" />
      </svg>
      <span style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 600 }}>Budget saved ✓</span>
    </div>
  );
}

// ─── Tips card ────────────────────────────────────────────────────────────────

function TipsCard() {
  const [open, setOpen] = useState(false);
  const tips = [
    'The 50/30/20 rule: 50% needs, 30% wants, 20% savings',
    'Your housing costs should ideally be under 35% of take-home pay',
    'Small subscriptions add up — review them monthly',
  ];
  return (
    <div style={{
      background: 'rgba(201,168,76,0.04)',
      border: '1px solid rgba(201,168,76,0.15)',
      borderRadius: 16, overflow: 'hidden',
      marginTop: 32, marginBottom: 80,
    }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: '#F5F0E8',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>💡 Budget Tips</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#8A9BB5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#C9A84C', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
              <span style={{ color: '#8A9BB5', fontSize: '0.875rem', lineHeight: 1.55 }}>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [income,         setIncome]         = useState('');
  const [budgets,        setBudgets]        = useState({});
  const [actuals,        setActuals]        = useState({});
  const [hasStatements,  setHasStatements]  = useState(false);
  const [customFixed,    setCustomFixed]    = useState([]);
  const [customVariable, setCustomVariable] = useState([]);
  const [unsaved,        setUnsaved]        = useState(false);
  const [showToast,      setShowToast]      = useState(false);
  const [loading,        setLoading]        = useState(true);

  const isFirstLoad    = useRef(true);
  const suppressUnsaved = useRef(false);
  const savedStateRef  = useRef(null);
  const incomePromptRef = useRef(null);

  function buildActuals(cb) {
    if (!cb) return;
    const map = {};
    const m = (key, id) => { if (cb[key]) map[id] = cb[key].total || 0; };
    m('Groceries',               'groceries');
    m('Eating Out',              'eating_out');
    m('Travel & Transport',      'transport');
    m('Entertainment & Leisure', 'entertainment');
    m('Direct Debits',           'subscriptions');
    m('Household Bills',         'utilities');
    m('Finance & Bills',         'loans');
    m('Rent & Mortgage',         'housing');
    m('Online Shopping',         'shopping');
    setActuals(prev => ({ ...prev, ...map }));
  }

  useEffect(() => {
    async function load() {
      let loaded = false;
      try {
        const res = await fetch('/api/budget');
        if (res.ok) {
          const { budget } = await res.json();
          if (budget) {
            const inc = budget.monthlyIncome ? String(budget.monthlyIncome) : '';
            const cats = budget.categories || {};
            const cf = cats._customFixed || [];
            const cv = cats._customVariable || [];
            const pureCats = { ...cats };
            delete pureCats._customFixed;
            delete pureCats._customVariable;
            setIncome(inc);
            setBudgets(pureCats);
            setCustomFixed(cf);
            setCustomVariable(cv);
            savedStateRef.current = { income: inc, budgets: pureCats, customFixed: cf, customVariable: cv };
            loaded = true;
          }
        }
      } catch (_) {}

      if (!loaded) {
        try {
          const saved = localStorage.getItem('sf_budget');
          if (saved) {
            const b = JSON.parse(saved);
            const inc = b.income || '';
            const cats = b.categories || {};
            const cf = b.customFixed || [];
            const cv = b.customVariable || [];
            setIncome(inc);
            setBudgets(cats);
            setCustomFixed(cf);
            setCustomVariable(cv);
            savedStateRef.current = { income: inc, budgets: cats, customFixed: cf, customVariable: cv };
          }
        } catch (_) {}
      }

      try {
        const r2 = await fetch('/api/statements');
        const { statements: list } = await r2.json();
        if (list && list.length > 0) {
          setHasStatements(true);
          const r3 = await fetch('/api/statements/' + list[0].id);
          const { statement } = await r3.json();
          if (statement?.rawData?.categoryBreakdown) {
            buildActuals(statement.rawData.categoryBreakdown);
          }
        }
      } catch (_) {}

      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (suppressUnsaved.current) return;
    setUnsaved(true);
  }, [budgets, income, customFixed, customVariable]);

  const save = useCallback(async () => {
    const categories = {
      ...budgets,
      _customFixed:    customFixed,
      _customVariable: customVariable,
    };
    try {
      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyIncome: parseFloat(income) || null, categories }),
      });
    } catch (_) {}
    try {
      localStorage.setItem('sf_budget', JSON.stringify({
        income, categories: budgets, customFixed, customVariable,
      }));
    } catch (_) {}
    savedStateRef.current = {
      income,
      budgets: { ...budgets },
      customFixed: [...customFixed],
      customVariable: [...customVariable],
    };
    setUnsaved(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2200);
  }, [income, budgets, customFixed, customVariable]);

  const discard = useCallback(() => {
    suppressUnsaved.current = true;
    const s = savedStateRef.current;
    if (s) {
      setIncome(s.income);
      setBudgets({ ...s.budgets });
      setCustomFixed([...s.customFixed]);
      setCustomVariable([...s.customVariable]);
    }
    setUnsaved(false);
    setTimeout(() => { suppressUnsaved.current = false; }, 200);
  }, []);

  const allFixed    = useMemo(() => [...FIXED,    ...customFixed],    [customFixed]);
  const allVariable = useMemo(() => [...VARIABLE, ...customVariable], [customVariable]);

  const totalBudgeted = useMemo(() =>
    [...allFixed, ...allVariable].reduce((s, c) => s + (Number(budgets[c.id]) || 0), 0),
    [allFixed, allVariable, budgets]
  );

  const totalFixed    = useMemo(() => sectionTotal(allFixed,    budgets), [allFixed,    budgets]);
  const totalVariable = useMemo(() => sectionTotal(
    allVariable.filter(c => c.id !== 'savings'), budgets
  ), [allVariable, budgets]);
  const totalSavings  = Number(budgets['savings']) || 0;

  const incomeNum = parseFloat(income) || 0;
  const allocPct  = incomeNum > 0 ? Math.round((totalBudgeted / incomeNum) * 100) : 0;

  const score = useMemo(() =>
    calcHealthScore(incomeNum, [...allFixed, ...allVariable], budgets, totalBudgeted),
    [incomeNum, allFixed, allVariable, budgets, totalBudgeted]
  );

  function setBudgetFor(id, val) {
    setBudgets(prev => ({ ...prev, [id]: val }));
  }

  function handleSetIncome(val) {
    setIncome(String(val));
  }

  function addCustom(section, { emoji, label, max }) {
    const cat = { id: 'custom_' + Date.now(), emoji, label, max };
    if (section === 'fixed') setCustomFixed(p => [...p, cat]);
    else setCustomVariable(p => [...p, cat]);
  }

  function scrollToIncomePrompt() {
    if (incomePromptRef.current) {
      incomePromptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inp = incomePromptRef.current.querySelector('input');
      if (inp) setTimeout(() => inp.focus(), 400);
    }
  }

  if (loading) {
    return (
      <DashboardLayout title="Budget">
        <style>{`@keyframes sf-pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
        {/* Hero skeleton — full width */}
        <div style={{
          height: 300, background: '#0D1117',
          border: '1px solid rgba(201,168,76,0.08)',
          borderRadius: 20, marginBottom: 32,
          animation: 'sf-pulse 1.6s ease-in-out infinite',
        }} />
        {/* Content skeleton — constrained */}
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              height: 96, background: '#0D1117',
              border: '1px solid rgba(201,168,76,0.06)',
              borderRadius: 16, marginBottom: 8,
              animation: 'sf-pulse 1.6s ease-in-out infinite',
              animationDelay: (i * 0.08) + 's',
            }} />
          ))}
        </div>
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
        .sf-income-val:hover { text-decoration: underline; text-underline-offset: 3px; }

        .sf-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 4px;
          outline: none;
          cursor: pointer;
          border: none;
          display: block;
          padding: 6px 0;
          box-sizing: content-box;
        }
        .sf-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #C9A84C, #E8C97A);
          cursor: grab;
          box-shadow: 0 0 0 4px rgba(201,168,76,0.3), 0 0 10px rgba(201,168,76,0.55), 0 2px 4px rgba(0,0,0,0.3);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .sf-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 0 6px rgba(201,168,76,0.35), 0 0 20px rgba(201,168,76,0.75), 0 2px 4px rgba(0,0,0,0.3);
          transform: scale(1.1);
        }
        .sf-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.2);
          box-shadow: 0 0 0 8px rgba(201,168,76,0.25), 0 0 24px rgba(201,168,76,0.8), 0 2px 4px rgba(0,0,0,0.3);
        }
        .sf-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #C9A84C, #E8C97A);
          cursor: grab;
          border: none;
          box-shadow: 0 0 0 4px rgba(201,168,76,0.3), 0 0 10px rgba(201,168,76,0.55);
        }
        .sf-slider::-webkit-slider-runnable-track {
          border-radius: 4px;
          height: 8px;
        }
        .sf-slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
        }
      `}</style>

      {/* Hero — full width of content area */}
      <HeroCard
        incomeNum={incomeNum}
        totalBudgeted={totalBudgeted}
        totalFixed={totalFixed}
        totalVariable={totalVariable}
        totalSavings={totalSavings}
        allocPct={allocPct}
        score={score}
        onSetIncome={handleSetIncome}
        onScrollToIncome={scrollToIncomePrompt}
      />

      {/* Constrained content */}
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {incomeNum === 0 && (
          <div ref={incomePromptRef} style={{ marginTop: 24 }}>
            <IncomePromptCard onSet={handleSetIncome} />
          </div>
        )}

        <div style={{ marginTop: incomeNum === 0 ? 24 : 0 }} />

        {!hasStatements && (
          <div style={{
            background: 'rgba(201,168,76,0.04)',
            border: '1px solid rgba(201,168,76,0.12)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <span style={{ color: '#8A9BB5', fontSize: '0.875rem' }}>
              Upload a bank statement to see your actual spend vs budget
            </span>
            <a href="/statements" style={{
              color: '#C9A84C', fontWeight: 600, fontSize: '0.82rem',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Upload Statement →
            </a>
          </div>
        )}

        {/* Fixed costs */}
        <SectionHeader emoji="🏠" title="Fixed Costs" cats={allFixed} budgets={budgets} incomeNum={incomeNum} />
        {allFixed.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            budget={budgets[cat.id] || 0}
            actual={actuals[cat.id]}
            hasStatements={hasStatements}
            onChange={val => setBudgetFor(cat.id, val)}
          />
        ))}
        <AddCategoryForm onAdd={item => addCustom('fixed', item)} />

        <div style={{ marginTop: 40 }} />

        {/* Variable costs */}
        <SectionHeader emoji="🔄" title="Variable Costs" cats={allVariable} budgets={budgets} incomeNum={incomeNum} />
        {allVariable.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            budget={budgets[cat.id] || 0}
            actual={actuals[cat.id]}
            hasStatements={hasStatements}
            onChange={val => setBudgetFor(cat.id, val)}
          />
        ))}
        <AddCategoryForm onAdd={item => addCustom('variable', item)} />

        <TipsCard />
      </div>

      <FloatingSaveBar visible={unsaved} onSave={save} onDiscard={discard} />
      <Toast show={showToast} />
    </DashboardLayout>
  );
}
