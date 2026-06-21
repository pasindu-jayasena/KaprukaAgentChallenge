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
  docked?: boolean
  loading?: boolean
}

export function ChatInputBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  uiLang,
  docked = false,
  loading = false,
}: Props) {
  const [focused, setFocused] = useState(false)
  const handleSpeech = useCallback((text: string) => onChange(text), [onChange])
  const { listening, supported, toggle } = useSpeech(uiLang, handleSpeech)

  const submit = () => {
    if (!loading && value.trim()) onSubmit(value)
  }

  return (
    <div
      className={`relative mx-auto ${docked ? 'w-[min(700px,94vw)]' : 'w-full max-w-[680px]'}`}
    >
      <div
        className={`glass-input flex items-center gap-2.5 rounded-full border border-white/90 transition-all duration-300 ${
          docked ? 'px-5 py-2 pl-6' : 'px-6 py-2.5 pl-7'
        } ${focused ? 'glass-input-focus shadow-glass-lg' : 'shadow-glass'}`}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder={placeholder}
          disabled={loading}
          className="min-w-0 flex-1 border-none bg-transparent text-base text-[#1A1433] outline-none placeholder:text-[#1A1433]/40"
        />
        {supported && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Voice input"
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-all ${
              listening
                ? 'bg-kapruka-header text-white shadow-[0_0_0_4px_rgba(64,31,96,0.15)]'
                : 'bg-kapruka-header/10 text-kapruka-header hover:bg-kapruka-header/15'
            }`}
            style={{ animation: listening ? 'agentPulse 1.4s ease-in-out infinite' : undefined }}
          >
            <Mic className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={loading || !value.trim()}
          aria-label="Send"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] border-none transition-transform hover:scale-105 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg,#FFE08A,#FCE22A)',
            boxShadow: '0 3px 10px rgba(252,226,42,0.5)',
          }}
        >
          <ArrowUp className="h-5 w-5 text-kapruka-header" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
