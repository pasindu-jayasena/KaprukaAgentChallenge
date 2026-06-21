'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Moon, Search, ShoppingCart, Sun } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { CartBadge } from '@/components/shell/CartBadge'
import type { UiLang } from '@/types'

const LANGS: { code: UiLang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'si', label: 'සිං' },
  { code: 'ta', label: 'தமி' },
]

interface Props {
  onCartOpen?: () => void
  cartOpen?: boolean
  layout?: 'default' | 'chat'
  onMenuToggle?: () => void
  showMenuIcon?: boolean
}

export function AppHeader({ onCartOpen, cartOpen = false, onMenuToggle, showMenuIcon }: Props) {
  const router = useRouter()
  const { messages, uiLang, setUiLang } = useLanguage()
  const { theme, toggle } = useTheme()

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = (fd.get('q') as string)?.trim()
    if (q) router.push(`/chat?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="kap-topnav" role="banner">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1 sm:gap-4 h-full">
        {/* Left: Menu + Logo */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {onMenuToggle && (
            <div className={showMenuIcon ? 'flex' : 'flex lg:hidden'}>
              <button
                type="button"
                onClick={onMenuToggle}
                className="kap-nav-icon"
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          )}
          <Link href="/" className="kap-logo flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap">
            <span>kapr<span className="kap-logo-accent">u</span>ka</span>
            <span className="text-base font-bold text-[#FCE22A] tracking-wide">Anu</span>
          </Link>
        </div>

        {/* Center: Spacer to push actions right, plus optional Search pill */}
        <div className="flex-1 flex justify-end sm:justify-start min-w-0">
          <div className="hidden lg:flex flex-1 max-w-[580px] mx-2 min-w-0">
            <form onSubmit={handleSearch} className="kap-search-pill w-full">
              <input
                name="q"
                type="text"
                className="kap-search-input min-w-0 w-full"
                placeholder="SEARCH PRODUCTS.."
                autoComplete="off"
              />
              <button type="submit" className="kap-search-btn" aria-label="Search">
                <Search className="h-4 w-4 text-[#2D2D2D]" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Language toggle */}
          <div className="kap-lang-pill flex items-center">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setUiLang(l.code)}
                className={`kap-lang-btn ${uiLang === l.code ? 'kap-lang-btn--active' : ''}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Cart */}
          <button
            type="button"
            onClick={onCartOpen}
            aria-label={messages.nav.cart}
            aria-expanded={cartOpen}
            className={`kap-nav-icon relative ${cartOpen ? 'kap-nav-icon--active' : ''}`}
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            <CartBadge />
          </button>

          {/* Dark mode */}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'light' ? 'Dark mode' : 'Light mode'}
            className="kap-nav-icon"
          >
            {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </header>
  )
}
