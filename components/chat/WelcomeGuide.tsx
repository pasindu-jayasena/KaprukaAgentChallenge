'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, HeartHandshake, ShoppingBasket, PlugZap, Truck, X } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'

interface Props {
  onPick?: (prompt: string) => void
  disabled?: boolean
}

const STARTER_ICONS = {
  sensitive: HeartHandshake,
  self: ShoppingBasket,
  birthday: Gift,
  find: PlugZap,
  track: Truck,
} as const

export function WelcomeGuide({ onPick, disabled = false }: Props) {
  const { messages } = useLanguage()
  const w = messages.welcome
  const starters = (Object.keys(STARTER_ICONS) as Array<keyof typeof STARTER_ICONS>).map(
    (key) => ({
      icon: STARTER_ICONS[key],
      label: w.starters[key].label,
      description: w.starters[key].desc,
      prompt: w.starters[key].prompt,
    })
  )
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (disabled) return

    const dismissed = localStorage.getItem('anu-welcome-dismissed')
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 700)
      return () => clearTimeout(timer)
    }
  }, [disabled])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem('anu-welcome-dismissed', 'true')
  }

  const pick = (prompt: string) => {
    dismiss()
    onPick?.(prompt)
  }

  return (
    <AnimatePresence>
      {visible && !disabled && (
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 220 }}
          className="mx-auto mb-2 mt-3 w-full max-w-[min(520px,calc(100vw-1.5rem))]"
        >
          <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-surface-elevated)] p-4 shadow-lg sm:p-5">
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--rail-hover)] hover:text-[var(--text-primary)]"
              aria-label={w.dismiss}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-9">
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                {w.heading}
              </h3>
              <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">
                {w.subtitle}
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {starters.map((starter) => {
                const Icon = starter.icon
                return (
                  <button
                    key={starter.label}
                    type="button"
                    onClick={() => pick(starter.prompt)}
                    className="group flex w-full items-start gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-page)] px-3 py-2.5 text-left transition-all hover:border-[var(--border-focus)] hover:bg-[var(--rail-hover)]"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kapruka-header/10 text-kapruka-header dark:bg-[#FCE22A]/10 dark:text-[#FCE22A]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-[var(--text-primary)]">
                        {starter.label}
                      </span>
                      <span className="mt-0.5 block break-words text-xs leading-snug text-[var(--text-secondary)]">
                        {starter.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

