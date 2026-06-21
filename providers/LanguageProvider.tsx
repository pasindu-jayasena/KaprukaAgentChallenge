'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { UiLang } from '@/types'
import { getMessages, type Messages } from '@/lib/i18n'

interface LanguageContextValue {
  uiLang: UiLang
  setUiLang: (lang: UiLang) => void
  messages: Messages
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [uiLang, setUiLangState] = useState<UiLang>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('uiLang') as UiLang | null
    if (stored && ['en', 'si', 'ta'].includes(stored)) {
      setUiLangState(stored)
    }
    setMounted(true)
  }, [])

  const setUiLang = useCallback((lang: UiLang) => {
    setUiLangState(lang)
    localStorage.setItem('uiLang', lang)
    document.documentElement.lang = lang
  }, [])

  useEffect(() => {
    if (mounted) document.documentElement.lang = uiLang
  }, [uiLang, mounted])

  const messages = getMessages(uiLang)

  return (
    <LanguageContext.Provider value={{ uiLang, setUiLang, messages }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
