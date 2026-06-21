'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, ShoppingCart, MapPin, X } from 'lucide-react'

export function WelcomeGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if not dismissed previously
    const dismissed = localStorage.getItem('anu-welcome-dismissed')
    if (!dismissed) {
      // Small delay so it animates in after the chat UI loads
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem('anu-welcome-dismissed', 'true')
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="mx-auto mt-4 mb-2 w-full max-w-[420px]"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-surface-elevated)] p-5 shadow-lg">
            {/* Background Accent */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-kapruka-accent/10 blur-3xl pointer-events-none" />

            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                👋 Welcome! Here's how Anu works:
              </h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--rail-hover)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Dismiss guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-3 mb-5">
              <li className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <span><strong className="text-[var(--text-primary)]">Ask anything</strong> in English, Sinhala, or Tamil.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:bg-green-400/10 dark:text-green-400">
                  <ShoppingCart className="h-3.5 w-3.5" />
                </div>
                <span><strong className="text-[var(--text-primary)]">Tap products</strong> to add them to your cart.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-400">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <span><strong className="text-[var(--text-primary)]">Give the address</strong> and Anu will handle delivery.</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full rounded-xl bg-[var(--rail-hover)] py-2.5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--border-light)] transition-colors"
            >
              Got it!
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
