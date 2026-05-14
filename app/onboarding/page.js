'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const STEP1_OPTIONS = [
  { id: 'track',      emoji: '📊', label: 'Track my spending' },
  { id: 'business',   emoji: '💼', label: 'Business expenses' },
  { id: 'tax',        emoji: '🧾', label: 'Prepare for tax' },
  { id: 'budget',     emoji: '💰', label: 'Build a budget' },
  { id: 'understand', emoji: '🔍', label: 'Understand my money' },
  { id: 'explore',    emoji: '🙂', label: 'Just exploring' },
]

const BANKS = [
  { id: 'barclays',    name: 'Barclays' },
  { id: 'hsbc',        name: 'HSBC' },
  { id: 'lloyds',      name: 'Lloyds' },
  { id: 'natwest',     name: 'NatWest' },
  { id: 'monzo',       name: 'Monzo' },
  { id: 'starling',    name: 'Starling' },
  { id: 'santander',   name: 'Santander' },
  { id: 'halifax',     name: 'Halifax' },
  { id: 'nationwide',  name: 'Nationwide' },
  { id: 'tsb',         name: 'TSB' },
  { id: 'firstdirect', name: 'First Direct' },
  { id: 'chase',       name: 'Chase UK' },
  { id: 'revolut',     name: 'Revolut' },
  { id: 'coop',        name: 'Co-op Bank' },
  { id: 'metro',       name: 'Metro Bank' },
  { id: 'other',       name: 'Other' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(1)
  const [step1Selected, setStep1Selected] = useState([])
  const [step2Selected, setStep2Selected] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  function toggleStep1(id) {
    setStep1Selected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleBank(id) {
    setStep2Selected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function finish(banks) {
    setSaving(true)
    localStorage.setItem('sf_onboarding_complete', 'true')
    localStorage.setItem('sf_onboarding_goals', JSON.stringify(step1Selected))
    localStorage.setItem('sf_onboarding_banks', JSON.stringify(banks))

    if (session?.user?.id) {
      try {
        await fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ banks }),
        })
      } catch (_) {}
    }

    router.push('/statements')
  }

  const bankBtnLabel = step2Selected.length === 0
    ? 'Finish setup →'
    : `Continue with ${step2Selected.length} bank${step2Selected.length === 1 ? '' : 's'} →`

  return (
    <div style={{
      background: '#080C14', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 16px 60px',
    }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '48px', marginTop: '8px', alignItems: 'center' }}>
        {[1, 2].map(dot => (
          <div key={dot} style={{
            height: '8px',
            width: dot === step ? '24px' : '8px',
            borderRadius: '50px',
            background: dot === step ? '#C9A84C' : 'rgba(201,168,76,0.3)',
            transition: 'width 0.3s ease',
          }} />
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h1 style={{
            color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700,
            letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 8px 0',
          }}>
            What brings you to MoneySorted?
          </h1>
          <p style={{ color: '#8A9BB5', fontSize: '1rem', textAlign: 'center', margin: '0 0 40px 0' }}>
            We&apos;ll personalise your experience
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px', maxWidth: '680px', width: '100%',
          }}>
            {STEP1_OPTIONS.map(option => {
              const selected = step1Selected.includes(option.id)
              return (
                <div key={option.id} onClick={() => toggleStep1(option.id)} style={{
                  background: selected ? 'rgba(201,168,76,0.08)' : '#0D1117',
                  border: selected ? '2px solid #C9A84C' : '1px solid rgba(201,168,76,0.15)',
                  borderRadius: '12px', padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '10px', cursor: 'pointer', transition: 'all 0.15s ease',
                  textAlign: 'center', userSelect: 'none',
                }}>
                  <span style={{ fontSize: '2rem', lineHeight: 1 }}>{option.emoji}</span>
                  <span style={{
                    color: selected ? '#F5F0E8' : '#8A9BB5',
                    fontSize: '0.9rem', fontWeight: selected ? 600 : 400,
                  }}>
                    {option.label}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={step1Selected.length === 0}
            style={{
              marginTop: '40px',
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#080C14', fontWeight: 700, padding: '13px 32px',
              borderRadius: '50px', border: 'none',
              cursor: step1Selected.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '1rem', opacity: step1Selected.length === 0 ? 0.4 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h1 style={{
            color: '#F5F0E8', fontSize: '1.8rem', fontWeight: 700,
            letterSpacing: '-0.02em', textAlign: 'center', margin: '0 0 8px 0',
          }}>
            Which banks do you use?
          </h1>
          <p style={{ color: '#8A9BB5', fontSize: '1rem', textAlign: 'center', margin: '0 0 40px 0' }}>
            Select all that apply — we&apos;ll optimise for your banks
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '10px', maxWidth: '680px', width: '100%',
          }}>
            {BANKS.map(bank => {
              const selected = step2Selected.includes(bank.id)
              return (
                <div key={bank.id} onClick={() => toggleBank(bank.id)} style={{
                  background: selected ? 'rgba(201,168,76,0.08)' : '#0D1117',
                  border: selected ? '2px solid #C9A84C' : '1px solid rgba(201,168,76,0.15)',
                  borderRadius: '12px', padding: '16px 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  textAlign: 'center', userSelect: 'none',
                }}>
                  <span style={{
                    color: selected ? '#F5F0E8' : '#8A9BB5',
                    fontSize: '0.9rem', fontWeight: 600,
                  }}>
                    {bank.name}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => finish(step2Selected)}
            disabled={saving}
            style={{
              marginTop: '40px',
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#080C14', fontWeight: 700, padding: '13px 32px',
              borderRadius: '50px', border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '1rem', opacity: saving ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {saving ? 'Saving…' : bankBtnLabel}
          </button>

          <button
            onClick={() => finish([])}
            disabled={saving}
            style={{
              marginTop: '14px', background: 'none', border: 'none',
              color: '#4A5568', fontSize: '0.82rem', cursor: 'pointer',
              textDecoration: 'none', padding: '4px 8px',
            }}
          >
            Skip for now →
          </button>
        </div>
      )}
    </div>
  )
}
