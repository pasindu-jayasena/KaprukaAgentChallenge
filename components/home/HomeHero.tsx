'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] as const },
  }),
}

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
    en: 'Ask Anu — Your Shopping Assistant',
    si: 'Anu ගෙන් අහන්න — ඔබේ සාප්පු සහායක',
    ta: 'Anu கேளுங்கள் — உங்கள் ஷாப்பிங் உதவியாளர்',
  }

  const t = sectionTitle[uiLang as keyof typeof sectionTitle] ?? sectionTitle.en

  const heroText = {
    en: {
      title: 'FATHERS SHAPE OUR WORLD',
      subtitle: "THIS FATHER'S DAY, SHAPE HIS SMILE",
      tagline: 'Gifts that speak louder than words.',
    },
    si: {
      title: 'පියවරුන් අපගේ ලෝකය හැඩගස්වයි',
      subtitle: 'මේ පිතෘ දිනයට, ඔහුගේ සිනහව හැඩගස්වන්න',
      tagline: 'වචනවලට වඩා කතා කරන තෑගි.',
    },
    ta: {
      title: 'தந்தையர் நம் உலகை வடிவமைக்கிறார்கள்',
      subtitle: 'இந்த தந்தையர் தினத்தில், அவரது புன்னகையை வடிவமையுங்கள்',
      tagline: 'வார்த்தைகளை விட பேசும் பரிசுகள்.',
    },
  }

  const heroT = heroText[uiLang as keyof typeof heroText] ?? heroText.en

  return (
    <section className="relative w-full">
      {/* Background Banner Container */}
      <div className="w-full relative overflow-hidden h-[160px] sm:h-[180px] lg:h-[200px]">
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
      <div className="relative z-10 mx-auto w-full max-w-[800px] px-4 -mt-20 sm:-mt-24 lg:-mt-28 mb-8 sm:mb-12">
        <motion.div
          className="hero-panel bg-[var(--bg-surface-elevated)] shadow-2xl ring-1 ring-[var(--border-light)]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, type: 'spring', stiffness: 80, damping: 20 }}
          style={{ borderRadius: '24px' }}
        >
          <div className="mb-6 flex items-center justify-center gap-2.5 text-center">
            <MessageCircle className="h-6 w-6 text-[var(--text-primary)]" />
            <h2 className="font-display text-[22px] font-bold text-[var(--text-primary)] sm:text-2xl">
              {t}
            </h2>
          </div>

          <div className="mx-auto w-full max-w-[640px]">
            <ProgressInputBar
              value={input}
              onChange={setInput}
              onSubmit={goChat}
              placeholder={messages.chat.openingPlaceholder}
              uiLang={uiLang as UiLang}
              journeyStep={0}
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-3">
            {chips.map((chip) => {
              const Icon = chip.icon
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => goChat(chip.goal)}
                  className="glass-chip flex items-center gap-2 rounded-full border border-[var(--border-medium)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--rail-hover)] shadow-sm transition-all"
                >
                  <Icon className="h-[18px] w-[18px] text-[var(--text-primary)]" />
                  {chip.label}
                </button>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
