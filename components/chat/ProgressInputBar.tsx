'use client'

import { useState, useCallback } from 'react'
import { ArrowUp, Mic } from 'lucide-react'
import { useSpeech } from '@/hooks/useSpeech'
import type { UiLang } from '@/types'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  placeholder: string
  uiLang: UiLang
  journeyStep?: number
  loading?: boolean
  docked?: boolean
}

export function ProgressInputBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  uiLang,
  journeyStep = 0,
  loading = false,
  docked = false,
}: Props) {
  const [focused, setFocused] = useState(false)
  const handleSpeech = useCallback((text: string) => onChange(text), [onChange])
  const { listening, supported, toggle } = useSpeech(uiLang, handleSpeech)

  const progress = Math.min(100, (journeyStep / 4) * 100)

  const submit = () => {
    if (!loading && value.trim()) onSubmit(value)
  }

  return (
    <div className={`relative mx-auto ${docked ? 'w-full' : 'w-full max-w-[680px]'}`}>
      <div className={`progress-input-wrap ${focused ? 'ring-0' : ''}`}>
        {/* Progress line at bottom */}
        {progress > 0 && (
          <div className="progress-input-fill" style={{ width: `${progress}%` }} aria-hidden />
        )}

        <div className="progress-input-inner gap-2 py-1.5 pr-1.5 sm:py-2 sm:pr-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
            placeholder={placeholder}
            disabled={loading}
            className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />

          <div className="input-actions flex shrink-0 items-center gap-1">
            {supported && (
              <button
                type="button"
                onClick={toggle}
                aria-label="Voice input"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                  listening
                    ? 'bg-kapruka-header text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:bg-[var(--rail-hover)] hover:text-[var(--text-primary)]'
                }`}
                style={{ animation: listening ? 'agentPulse 1.4s ease-in-out infinite' : undefined }}
              >
                <Mic className="h-4 w-4" strokeWidth={1.9} />
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={loading || !value.trim()}
              aria-label="Send"
              className="input-send-btn flex h-9 w-9 items-center justify-center rounded-full border-none transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed"
            >
              <ArrowUp className="h-[18px] w-[18px] text-kapruka-header" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
