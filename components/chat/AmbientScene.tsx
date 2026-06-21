'use client'

import { useMemo } from 'react'

type Dot = {
  left: number
  delay: number
  duration: number
  size: number
  drift: number
  opacity: number
}

function buildDots(count: number): Dot[] {
  return Array.from({ length: count }, (_, i) => ({
    left: (i * 23 + 11) % 96 + 2,
    delay: (i * 1.8) % 28,
    duration: 22 + (i % 12) * 2,
    size: 2 + (i % 4),
    drift: ((i % 5) - 2) * 18,
    opacity: 0.15 + (i % 5) * 0.04,
  }))
}

const DOTS = buildDots(20)

export function AmbientScene() {
  const dots = useMemo(() => DOTS, [])

  return (
    <div className="ambient-scene pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="ambient-base absolute inset-0" />
      <div className="ambient-glow absolute inset-0" />

      <div className="absolute inset-0" style={{ contain: 'strict' }}>
        {dots.map((d, i) => (
          <span
            key={i}
            className="ambient-dot"
            style={{
              left: `${d.left}%`,
              width: d.size,
              height: d.size,
              ['--dot-opacity' as string]: String(d.opacity),
              ['--dot-drift' as string]: `${d.drift}px`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
