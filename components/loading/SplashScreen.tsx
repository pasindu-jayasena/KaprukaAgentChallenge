'use client'

import { useEffect, useState } from 'react'

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 1200)
    const t2 = setTimeout(() => setVisible(false), 1700)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`splash-screen fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === 'out' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden={phase === 'out'}
    >
      {/* Pulsing ring behind logo */}
      <div className="splash-ring absolute h-48 w-48 rounded-full sm:h-56 sm:w-56" />

      <div className={`relative flex flex-col items-center gap-5 ${
        phase === 'in' ? 'splash-content-in' : 'splash-content-out'
      }`}>
        {/* Logo mark */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24"
          style={{
            background: 'radial-gradient(circle at 34% 30%, #8a72d0, #401F60 72%)',
            boxShadow: '0 0 40px rgba(64, 31, 96, 0.5)',
          }}
        >
          <svg width="52" height="34" viewBox="0 0 24 15" fill="none">
            <path
              d="M3.5 2.5 A 8.5 8.5 0 0 0 20.5 2.5"
              stroke="#FCE22A"
              strokeWidth="4.2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        {/* Brand text */}
        <div className="text-center">
          <p className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl flex items-baseline justify-center gap-2">
            <span>kapr<span className="text-[#FCE22A]">u</span>ka</span>
            <span className="text-[#FCE22A]">Anu</span>
          </p>
          <p className="mt-2 text-sm font-medium text-white/60">
            Your shopping companion
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#FCE22A]/60"
              style={{
                animation: 'agentPulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
