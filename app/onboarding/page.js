'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

const STEP1_OPTIONS = [
  { id: 'track', emoji: '📊', label: 'Track my spending' },
  { id: 'business', emoji: '💼', label: 'Business expenses' },
  { id: 'tax', emoji: '🧾', label: 'Prepare for tax' },
  { id: 'budget', emoji: '💰', label: 'Build a budget' },
  { id: 'understand', emoji: '🔍', label: 'Understand my money' },
  { id: 'explore', emoji: '🙂', label: 'Just exploring' },
]

const BANKS = [
  { id: 'barclays', name: 'Barclays' },
  { id: 'hsbc', name: 'HSBC' },
  { id: 'lloyds', name: 'Lloyds' },
  { id: 'natwest', name: 'NatWest' },
  { id: 'monzo', name: 'Monzo' },
  { id: 'starling', name: 'Starling' },
  { id: 'santander', name: 'Santander' },
  { id: 'halifax', name: 'Halifax' },
  { id: 'other', name: 'Other' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(1)
  const [step1Selected, setStep1Selected] = useState([])
  const [step2Selected, setStep2Selected] = useState(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  function toggleStep1(id) {
    setStep1Selected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function finish() {
    localStorage.setItem('sf_onboarding_complete', 'true')
    localStorage.setItem('sf_onboarding_goals', JSON.stringify(step1Selected))
    localStorage.setItem('sf_onboarding_bank', step2Selected)
    router.push('/statements')
  }

  return (
    <div
      style={{
        background: '#080C14',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 16px 60px',
      }}
    >
      {/* Progress dots */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '48px',
          marginTop: '8px',
          alignItems: 'center',
        }}
      >
        {[1, 2].map((dot) => {
          const isActive = dot === step
          return (
            <div
              key={dot}
              style={{
                height: '8px',
                width: isActive ? '24px' : '8px',
                borderRadius: '50px',
                background: isActive ? '#C9A84C' : 'rgba(201,168,76,0.3)',
                transition: 'width 0.3s ease',
              }}
            />
          )
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <h1
            style={{
              color: '#F5F0E8',
              fontSize: '1.8rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              textAlign: 'center',
              marginBottom: '8px',
              margin: '0 0 8px 0',
            }}
          >
            What brings you to StatementFlow?
          </h1>
          <p
            style={{
              color: '#8A9BB5',
              fontSize: '1rem',
              textAlign: 'center',
              marginBottom: '40px',
              margin: '0 0 40px 0',
            }}
          >
            We&apos;ll personalise your experience
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              maxWidth: '680px',
              width: '100%',
            }}
          >
            {STEP1_OPTIONS.map((option) => {
              const selected = step1Selected.includes(option.id)
              return (
                <div
                  key={option.id}
                  onClick={() => toggleStep1(option.id)}
                  style={{
                    background: selected ? 'rgba(201,168,76,0.08)' : '#0D1117',
                    border: selected
                      ? '2px solid #C9A84C'
                      : '1px solid rgba(201,168,76,0.15)',
                    borderRadius: '12px',
                    padding: '20px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '2rem', lineHeight: 1 }}>
                    {option.emoji}
                  </span>
                  <span
                    style={{
                      color: selected ? '#F5F0E8' : '#8A9BB5',
                      fontSize: '0.9rem',
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
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
              color: '#080C14',
              fontWeight: 700,
              padding: '13px 32px',
              borderRadius: '50px',
              border: 'none',
              cursor: step1Selected.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              opacity: step1Selected.length === 0 ? 0.4 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <h1
            style={{
              color: '#F5F0E8',
              fontSize: '1.8rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              textAlign: 'center',
              marginBottom: '8px',
              margin: '0 0 8px 0',
            }}
          >
            Which bank do you mainly use?
          </h1>
          <p
            style={{
              color: '#8A9BB5',
              fontSize: '1rem',
              textAlign: 'center',
              marginBottom: '40px',
              margin: '0 0 40px 0',
            }}
          >
            We&apos;ll optimise parsing for your bank
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '10px',
              maxWidth: '680px',
              width: '100%',
            }}
          >
            {BANKS.map((bank) => {
              const selected = step2Selected === bank.id
              return (
                <div
                  key={bank.id}
                  onClick={() => setStep2Selected(bank.id)}
                  style={{
                    background: selected ? 'rgba(201,168,76,0.08)' : '#0D1117',
                    border: selected
                      ? '2px solid #C9A84C'
                      : '1px solid rgba(201,168,76,0.15)',
                    borderRadius: '12px',
                    padding: '16px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      color: selected ? '#F5F0E8' : '#8A9BB5',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                    }}
                  >
                    {bank.name}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={finish}
            disabled={!step2Selected}
            style={{
              marginTop: '40px',
              background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
              color: '#080C14',
              fontWeight: 700,
              padding: '13px 32px',
              borderRadius: '50px',
              border: 'none',
              cursor: !step2Selected ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              opacity: !step2Selected ? 0.4 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            Finish setup →
          </button>
        </div>
      )}
    </div>
  )
}
