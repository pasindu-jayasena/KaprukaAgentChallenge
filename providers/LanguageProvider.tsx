'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { UiLang } from '@/types'
import { getMessages, formatMessage, type Messages } from '@/lib/i18n'

interface LanguageContextValue {
  uiLang: UiLang
  setUiLang: (lang: UiLang) => void
  messages: Messages
  format: typeof formatMessage
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function readStoredUiLang(): UiLang {
  if (typeof window === 'undefined') return 'en'
  const stored = localStorage.getItem('uiLang') as UiLang | null
  return stored && ['en', 'si', 'ta'].includes(stored) ? stored : 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [uiLang, setUiLangState] = useState<UiLang>(readStoredUiLang)

  const setUiLang = useCallback((lang: UiLang) => {
    setUiLangState(lang)
    localStorage.setItem('uiLang', lang)
    document.documentElement.lang = lang
  }, [])

  useEffect(() => {
    document.documentElement.lang = uiLang
  }, [uiLang])

  const messages = getMessages(uiLang)

  return (
    <LanguageContext.Provider value={{ uiLang, setUiLang, messages, format: formatMessage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
