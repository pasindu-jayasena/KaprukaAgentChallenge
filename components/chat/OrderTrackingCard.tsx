'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import type { OrderTracking } from '@/types'

interface Props {
  tracking: OrderTracking
}

export function OrderTrackingCard({ tracking }: Props) {
  return (
    <div className="rounded-xl border border-kapruka-header/20 bg-[var(--bg-surface)] p-4">
      <p className="font-semibold text-kapruka-header">{tracking.ref}</p>
      <p className="text-sm text-[var(--text-secondary)]">{tracking.status}</p>
      {tracking.eta && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">ETA: {tracking.eta}</p>
      )}
      {tracking.steps && tracking.steps.length > 0 && (
        <ul className="mt-4 space-y-3">
          {tracking.steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-[var(--text-muted)]" />
              )}
              <span className={step.done ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
