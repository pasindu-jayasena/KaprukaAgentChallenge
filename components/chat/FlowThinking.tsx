'use client'

import { AnuLogoMark } from '@/components/shell/AnuLogoMark'
import type { StatusEvent } from '@/types'

interface Props {
  events: StatusEvent[]
  fallback?: string
}

export function FlowThinking({ events, fallback = 'Anu is on it…' }: Props) {
  const hasReal = events.length > 0

  return (
    <div className="my-4 flex items-start gap-4 animate-rise">
      <AnuLogoMark size="md" />
      <div className="glass-card min-w-[240px] max-w-full rounded-[20px] p-4 sm:p-5">
        <p className="mb-3 font-display text-[15px] font-semibold text-kapruka-header dark:text-[var(--text-primary)]">
          {hasReal ? fallback : 'Thinking…'}
        </p>
        {hasReal && (
          <ul className="flex flex-col gap-2">
            {events.map((ev, i) => {
              const isLast = i === events.length - 1
              return (
                <li key={i} className="flex items-center gap-2.5 text-sm text-[#1A1433]/80 dark:text-[var(--text-secondary)]">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${isLast
                        ? 'border border-dashed border-kapruka-header/35 bg-kapruka-header/10'
                        : 'bg-gradient-to-br from-[#FFE08A] to-kapruka-accent text-kapruka-header'
                      }`}
                    style={{ animation: isLast ? 'agentPulse 1.6s ease-in-out infinite' : undefined }}
                  >
                    {!isLast && '✓'}
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
