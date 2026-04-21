'use client'

import { useState, useEffect, useMemo } from 'react';
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
  { id: 'groceries',     label: 'Groceries',               color: '#16a34a' },
  { id: 'eating_out',    label: 'Eating Out & Takeaway',    color: '#ea580c' },
  { id: 'transport',     label: 'Transport',                color: '#2563eb' },
  { id: 'fuel',          label: 'Fuel',                     color: '#ca8a04' },
  { id: 'shopping',      label: 'Shopping',                 color: '#db2777' },
  { id: 'entertainment', label: 'Entertainment',            color: '#7c3aed' },
  { id: 'subscriptions', label: 'Subscriptions',            color: '#a855f7' },
  { id: 'personal_care', label: 'Personal Care',            color: '#ec4899' },
  { id: 'savings',       label: 'Savings',                  color: '#059669' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);
}

// ─── Summary Stat ─────────────────────────────────────────────────────────────

function SummaryStat({ label, value, valueColor }) {
  return (
    <div>
      <div style={{ color: valueColor, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ color: '#8A9BB5', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, budgets, setBudgets, actuals, saveBudget }) {
  const [focused, setFocused] = useState(false);
  const budget = parseFloat(budgets[cat.id]) || 0;
  const actual = actuals[cat.id] || 0;
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
  const barColor = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#00D4A0';
  const isOverBudget = budget > 0 && actual > budget;

  return (
    <div style={{
      background: '#0D1117',
      border: '1px solid rgba(201,168,76,0.1)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <div style={{ padding: '16px 20px' }}>
        {/* Top row: dot, label, input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: cat.color,
            flexShrink: 0,
          }} />
          <div style={{ color: '#F5F0E8', fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>
            {cat.label}
          </div>
          <input
            type="number"
            value={budgets[cat.id] || ''}
            placeholder="0"
            onChange={e => setBudgets(prev => ({ ...prev, [cat.id]: e.target.value }))}
            onBlur={() => { saveBudget(); setFocused(false); }}
            onFocus={() => setFocused(true)}
            style={{
              background: '#080C14',
              border: focused
                ? '1px solid rgba(201,168,76,0.6)'
                : '1px solid rgba(201,168,76,0.15)',
              color: '#F5F0E8',
              padding: '7px 12px',
              borderRadius: 8,
              fontSize: '0.875rem',
              width: 100,
              textAlign: 'right',
              outline: 'none',
              transition: 'border-color 150ms ease',
            }}
          />
        </div>

        {/* Progress row — only shown if budget is set */}
        {budget > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#8A9BB5', fontSize: '0.75rem' }}>Spent: {fmt(actual)}</span>
              <span style={{ color: '#8A9BB5', fontSize: '0.75rem' }}>Budget: {fmt(budget)}</span>
            </div>
            <div style={{ height: 3, background: '#1E2A3A', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: pct + '%',
                height: '100%',
                background: barColor,
                borderRadius: 999,
                transition: 'width 0.6s ease',
              }} />
            </div>
            {isOverBudget && (
              <div style={{ color: '#EF4444', fontSize: '0.72rem', marginTop: 4 }}>
                {fmt(actual - budget)} over budget
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [income, setIncome] = useState('');
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [budgets, setBudgets] = useState({});
  const [actuals, setActuals] = useState({});
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedBudget, setSavedBudget] = useState(null);
  const [incomeInputFocused, setIncomeInputFocused] = useState(false);

  function buildActuals(catBreakdown) {
    const map = {};
    if (catBreakdown?.['Groceries'])              map['groceries']     = catBreakdown['Groceries'].total || 0;
    if (catBreakdown?.['Eating Out'])             map['eating_out']    = catBreakdown['Eating Out'].total || 0;
    if (catBreakdown?.['Travel & Transport'])     map['transport']     = catBreakdown['Travel & Transport'].total || 0;
    if (catBreakdown?.['Entertainment & Leisure'])map['entertainment'] = catBreakdown['Entertainment & Leisure'].total || 0;
    if (catBreakdown?.['Direct Debits'])          map['subscriptions'] = catBreakdown['Direct Debits'].total || 0;
    if (catBreakdown?.['Household Bills'])        map['utilities']     = catBreakdown['Household Bills'].total || 0;
    if (catBreakdown?.['Finance & Bills'])        map['loans']         = catBreakdown['Finance & Bills'].total || 0;
    if (catBreakdown?.['Rent & Mortgage'])        map['housing']       = catBreakdown['Rent & Mortgage'].total || 0;
    if (catBreakdown?.['Online Shopping'])        map['shopping']      = catBreakdown['Online Shopping'].total || 0;
    setActuals(map);
  }

  useEffect(() => {
    // Load saved budget from localStorage
    try {
      const saved = localStorage.getItem('sf_budget');
      if (saved) {
        const b = JSON.parse(saved);
        setIncome(b.income || '');
        setBudgets(b.categories || {});
      }
    } catch (e) {
      // ignore parse errors
    }

    // Fetch statements and use the most recent one's categoryBreakdown for actuals
    fetch('/api/statements')
      .then(r => r.json())
      .then(async ({ statements: list }) => {
        setStatements(list || []);
        if (list && list.length > 0) {
          try {
            const detailRes = await fetch('/api/statements/' + list[0].id);
            const { statement } = await detailRes.json();
            if (statement?.rawData?.categoryBreakdown) {
              buildActuals(statement.rawData.categoryBreakdown);
            }
          } catch (e) {
            // actuals remain empty
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function saveBudget() {
    try {
      localStorage.setItem('sf_budget', JSON.stringify({ income, categories: budgets }));
    } catch (e) {
      // ignore storage errors
    }
    setIncomeSaved(true);
    setTimeout(() => setIncomeSaved(false), 2000);
  }

  const totalBudgeted = useMemo(() => {
    return [...FIXED_CATEGORIES, ...VARIABLE_CATEGORIES]
      .reduce((sum, cat) => sum + (parseFloat(budgets[cat.id]) || 0), 0);
  }, [budgets]);

  const totalActual = useMemo(() => {
    return Object.values(actuals).reduce((s, v) => s + v, 0);
  }, [actuals]);

  const incomeNum = parseFloat(income) || 0;
  const remaining = incomeNum - totalBudgeted;

  return (
    <DashboardLayout title="Budget">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Budget
        </h1>
        <p style={{ color: '#8A9BB5', margin: 0, fontSize: '0.9rem' }}>
          Set monthly spending limits by category
        </p>
      </div>

      {/* Summary Card */}
      <div style={{
        background: '#0D1117',
        border: '1px solid rgba(201,168,76,0.12)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}>
          <SummaryStat
            label="Monthly Income"
            value={income ? fmt(parseFloat(income)) : 'Not set'}
            valueColor="#00D4A0"
          />
          <SummaryStat
            label="Total Budgeted"
            value={fmt(totalBudgeted)}
            valueColor="#C9A84C"
          />
          <SummaryStat
            label="Last Statement"
            value={fmt(totalActual)}
            valueColor="#EF4444"
          />
          <SummaryStat
            label="Left to Budget"
            value={income ? fmt(remaining) : '—'}
            valueColor={remaining >= 0 ? '#00D4A0' : '#EF4444'}
          />
        </div>
      </div>

      {/* Monthly Income Input */}
      <div style={{
        background: '#0D1117',
        border: '1px solid rgba(201,168,76,0.12)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 8,
      }}>
        <label style={{
          color: '#8A9BB5',
          fontSize: '0.8rem',
          fontWeight: 500,
          display: 'block',
          marginBottom: 8,
        }}>
          Monthly take-home income
        </label>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* £ prefix + input wrapper */}
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#8A9BB5',
              fontSize: '1rem',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              £
            </span>
            <input
              type="number"
              value={income}
              onChange={e => setIncome(e.target.value)}
              placeholder="2500"
              onFocus={() => setIncomeInputFocused(true)}
              onBlur={() => setIncomeInputFocused(false)}
              style={{
                background: '#080C14',
                border: incomeInputFocused
                  ? '1px solid rgba(201,168,76,0.6)'
                  : '1px solid rgba(201,168,76,0.2)',
                color: '#F5F0E8',
                padding: '11px 14px 11px 32px',
                borderRadius: 10,
                fontSize: '1rem',
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms ease',
              }}
            />
          </div>

          <button
            onClick={saveBudget}
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#080C14',
              fontWeight: 700,
              fontSize: '0.9rem',
              padding: '11px 24px',
              borderRadius: 50,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'opacity 150ms ease',
            }}
          >
            {incomeSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Fixed Costs Section */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F5F0E8', marginBottom: 12 }}>
          Fixed Costs
        </div>
        {FIXED_CATEGORIES.map(cat => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            budgets={budgets}
            setBudgets={setBudgets}
            actuals={actuals}
            saveBudget={saveBudget}
          />
        ))}
      </div>

      {/* Variable Costs Section */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#F5F0E8', marginBottom: 12 }}>
          Variable Costs
        </div>
        {VARIABLE_CATEGORIES.map(cat => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            budgets={budgets}
            setBudgets={setBudgets}
            actuals={actuals}
            saveBudget={saveBudget}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
