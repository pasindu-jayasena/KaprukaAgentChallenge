'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MessageCircle, Gift, Heart, PartyPopper, ShoppingBasket, Sparkles, Tag } from 'lucide-react'
import { ProgressInputBar } from '@/components/chat/ProgressInputBar'
import { useLanguage } from '@/providers/LanguageProvider'
import type { UiLang } from '@/types'

const CHIP_META = [
  { key: 'gift' as const, icon: Gift },
  { key: 'celebrate' as const, icon: PartyPopper },
  { key: 'say' as const, icon: Heart },
  { key: 'stock' as const, icon: ShoppingBasket },
  { key: 'surprise' as const, icon: Sparkles },
  { key: 'deals' as const, icon: Tag },
] as const

export function AskAnuSection() {
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
    en: 'Ask Anu — Your Shopping Assistant',
    si: '\u0d85\u0db1\u0dd4\u0d9c\u0dd9\u0db1\u0dca \u0d85\u0dc4\u0db1\u0dca\u0db1 - \u0d94\u0db6\u0dda \u0dc3\u0dcf\u0db4\u0dca\u0db4\u0dd4 \u0dc3\u0dc4\u0dcf\u0dba\u0d9a',
    ta: '\u0b85\u0ba9\u0bc1\u0bb5\u0bbf\u0b9f\u0bae\u0bcd \u0b95\u0bc7\u0bb3\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd - \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0bb7\u0bbe\u0baa\u0bcd\u0baa\u0bbf\u0b99\u0bcd \u0b89\u0ba4\u0bb5\u0bbf\u0baf\u0bbe\u0bb3\u0bb0\u0bcd',
  }

  const t = sectionTitle[uiLang as keyof typeof sectionTitle] ?? sectionTitle.en

  return (
    <section className="px-4 py-8 sm:py-12">
      <motion.div
        className="hero-panel mx-auto max-w-[720px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="mb-6 flex items-center justify-center gap-2 text-center">
          <MessageCircle className="h-5 w-5 text-[var(--kap-purple)]" />
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)] sm:text-xl">
            {t}
          </h2>
        </div>

        <ProgressInputBar
          value={input}
          onChange={setInput}
          onSubmit={goChat}
          placeholder={messages.chat.openingPlaceholder}
          uiLang={uiLang as UiLang}
          journeyStep={0}
        />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {chips.map((chip) => {
            const Icon = chip.icon
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => goChat(chip.goal)}
                className="glass-chip flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-[var(--text-primary)]"
              >
                <Icon className="h-3.5 w-3.5 text-[var(--kap-purple)]" />
                {chip.label}
              </button>
            )
          })}
        </div>
      </motion.div>
    </section>
  )
}
