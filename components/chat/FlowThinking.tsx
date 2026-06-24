'use client'

import { AnuLogoMark } from '@/components/shell/AnuLogoMark'
import { Check } from 'lucide-react'
import type { StatusEvent } from '@/types'

interface Props {
  events: StatusEvent[]
  fallback?: string
}

export function FlowThinking({ events, fallback = 'Anu is thinking through it...' }: Props) {
  const hasReal = events.length > 0

  return (
    <div className="my-4 flex items-start gap-4 animate-rise">
      <AnuLogoMark size="md" />
      <div className="glass-card min-w-[240px] max-w-full rounded-[20px] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <p className="font-display text-[15px] font-semibold text-kapruka-header dark:text-[var(--text-primary)]">
            {hasReal ? fallback : 'Anu is thinking through it'}
          </p>
          {!hasReal && (
            <span className="flex items-center gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-kapruka-header dark:bg-[#FCE22A]"
                  style={{
                    animation: 'agentPulse 1.1s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </span>
          )}
        </div>
        {hasReal && (
          <ul className="flex flex-col gap-2">
            {events.map((ev, i) => {
              const isLast = i === events.length - 1
              return (
                <li
                  key={`${ev.key}-${i}`}
                  className="flex items-center gap-2.5 text-sm text-[#1A1433]/80 dark:text-[var(--text-secondary)]"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                      isLast
                        ? 'border border-dashed border-kapruka-header/35 bg-kapruka-header/10'
                        : 'bg-gradient-to-br from-[#FFE08A] to-kapruka-accent text-kapruka-header'
                    }`}
                    style={{
                      animation: isLast ? 'agentPulse 1.6s ease-in-out infinite' : undefined,
                    }}
                  >
                    {!isLast && <Check className="h-3 w-3" strokeWidth={2.4} />}
                  </span>
                  {ev.label}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
