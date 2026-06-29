'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Menu,
  Search,
  ShoppingCart,
  Truck,
  User,
  ChevronDown,
  X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/providers/LanguageProvider'
import { useCartStore } from '@/store/cartStore'
import type { UiLang } from '@/types'
import { CartDrawer } from '@/components/cart/CartDrawer'

const LANG_OPTIONS: { code: UiLang; label: string }[] = [
  { code: 'en', label: 'Eng' },
  { code: 'si', label: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்' },
]

interface TopNavProps {
  compact?: boolean
  showAnu?: boolean
}

export function TopNav({ compact, showAnu }: TopNavProps) {
  const { messages, uiLang, setUiLang } = useLanguage()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const totalItems = useCartStore((s) => s.totalItems())

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!search.trim()) return
    router.push(`/chat?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-kapruka-header text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-white/10 lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-1 text-xl font-bold tracking-tight">
            <span>Kapr</span>
            <span className="relative">
              u
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-kapruka-accent" />
            </span>
            <span>ka</span>
          </Link>

          {showAnu && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kapruka-accent text-sm font-bold text-kapruka-header">
                A
              </div>
              <span className="text-sm font-medium opacity-90">{messages.chat.title}</span>
            </div>
          )}

          {!compact && (
            <form
              onSubmit={submitSearch}
              className="mx-auto hidden max-w-xl flex-1 items-center md:flex"
            >
              <div className="flex w-full overflow-hidden rounded-full bg-white shadow-inner">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={messages.nav.search}
                  className="flex-1 px-4 py-2.5 text-sm text-kapruka-text outline-none"
                />
                <button
                  type="submit"
                  className="flex h-11 w-11 items-center justify-center bg-kapruka-accent text-kapruka-text hover:brightness-95"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </form>
          )}

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-white/10"
              >
                {LANG_OPTIONS.find((l) => l.code === uiLang)?.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 min-w-[120px] overflow-hidden rounded-lg bg-white py-1 text-kapruka-text shadow-xl"
                  >
                    {LANG_OPTIONS.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => {
                          setUiLang(l.code)
                          setLangOpen(false)
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setCartOpen((open) => !open)}
              className="relative rounded-lg p-2 hover:bg-white/10"
              aria-label={messages.nav.cart}
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-kapruka-accent text-[10px] font-bold text-kapruka-header"
                >
                  {totalItems}
                </motion.span>
              )}
            </button>

            <Link
              href="/chat?intent=track"
              className="rounded-lg p-2 hover:bg-white/10"
              aria-label={messages.nav.track}
            >
              <Truck className="h-5 w-5" />
            </Link>

            <button
              type="button"
              className="hidden rounded-lg p-2 hover:bg-white/10 sm:block"
              aria-label={messages.nav.account}
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  )
}
