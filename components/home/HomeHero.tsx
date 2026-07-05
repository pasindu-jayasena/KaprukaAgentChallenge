'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Gift, Heart, PartyPopper, ShoppingBasket, Sparkles, Tag } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import { ProgressInputBar } from '@/components/chat/ProgressInputBar'
import type { UiLang } from '@/types'

const CHIP_META = [
  { key: 'gift' as const, icon: Gift },
  { key: 'celebrate' as const, icon: PartyPopper },
  { key: 'say' as const, icon: Heart },
  { key: 'stock' as const, icon: ShoppingBasket },
  { key: 'surprise' as const, icon: Sparkles },
  { key: 'deals' as const, icon: Tag },
] as const

export function HomeHero() {
  const router = useRouter()
  const { messages, uiLang } = useLanguage()
  const [input, setInput] = useState('')

  const chips = CHIP_META.map((m) => ({
    ...m,
    label: messages.chat.chips[m.key].label,
    goal: messages.chat.chips[m.key].goal,
  }))

  const goChat = async (text: string) => {
    if (!text.trim()) return
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: text.slice(0, 60) }),
    })
    const data = (await res.json()) as { id?: string }
    const q = encodeURIComponent(text.trim())
    router.push(data.id ? `/chat?session=${data.id}&q=${q}` : `/chat?q=${q}`)
  }

  const sectionTitle = {
    en: 'Ask Anu - Your Shopping Assistant',
    si: '\u0d85\u0db1\u0dd4\u0d9c\u0dd9\u0db1\u0dca \u0d85\u0dc4\u0db1\u0dca\u0db1 - \u0d94\u0db6\u0dda \u0dc3\u0dcf\u0db4\u0dca\u0db4\u0dd4 \u0dc3\u0dc4\u0dcf\u0dba\u0d9a',
    ta: '\u0b85\u0ba9\u0bc1\u0bb5\u0bbf\u0b9f\u0bae\u0bcd \u0b95\u0bc7\u0bb3\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd - \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0bb7\u0bbe\u0baa\u0bcd\u0baa\u0bbf\u0b99\u0bcd \u0b89\u0ba4\u0bb5\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd',
  }

  const t = sectionTitle[uiLang as keyof typeof sectionTitle] ?? sectionTitle.en

  return (
    <section className="relative w-full">
      {/* Background Banner Container */}
      <div className="home-hero-banner w-full relative overflow-hidden h-[160px] sm:h-[180px] lg:h-[200px]">
        {/* Background Image */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/hero-banner.png')",
          }}
        />
        {/* Dark Gradient Overlay for Contrast */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: 'linear-gradient(to bottom, rgba(64,31,96,0.3) 0%, rgba(26,10,42,0.8) 100%)',
          }}
        />
      </div>

      {/* Floating Card Over Banner via negative margin */}
      <div className="home-hero-wrap relative z-10 mx-auto mb-8 -mt-20 sm:-mt-24 sm:mb-12 lg:-mt-28">
        <div
          className="hero-panel min-w-0 overflow-hidden bg-[var(--bg-surface-elevated)] shadow-2xl ring-1 ring-[var(--border-light)]"
          style={{ borderRadius: '24px' }}
        >
          <div className="mb-5 min-w-0 text-center sm:mb-6">
            <h2 className="min-w-0 text-balance font-display text-lg font-bold leading-snug text-[var(--text-primary)] sm:text-2xl">
              <MessageCircle
                className="mr-2 inline-block h-5 w-5 shrink-0 align-[-0.2em] text-[var(--text-primary)] sm:h-6 sm:w-6"
                aria-hidden
              />
              {t}
            </h2>
          </div>

          <div className="home-input-wrap mx-auto w-full max-w-[640px]">
            <ProgressInputBar
              value={input}
              onChange={setInput}
              onSubmit={goChat}
              placeholder={messages.chat.openingPlaceholder}
              uiLang={uiLang as UiLang}
              journeyStep={0}
            />
          </div>

          <div className="home-quick-actions mt-6 grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
            {chips.map((chip) => {
              const Icon = chip.icon
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => goChat(chip.goal)}
                  className="home-quick-chip glass-chip flex min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full border border-[var(--border-medium)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--border-focus)] hover:bg-[var(--rail-hover)] sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-primary)] sm:h-[18px] sm:w-[18px]" />
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
