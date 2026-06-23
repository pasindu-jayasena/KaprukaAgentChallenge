'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
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

const languageListeners = new Set<() => void>()

function subscribeLanguage(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  languageListeners.add(onChange)
  queueMicrotask(onChange)
  return () => languageListeners.delete(onChange)
}

function emitLanguageChange() {
  languageListeners.forEach((listener) => listener())
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const uiLang = useSyncExternalStore<UiLang>(
    subscribeLanguage,
    readStoredUiLang,
    () => 'en'
  )

  const setUiLang = useCallback((lang: UiLang) => {
    localStorage.setItem('uiLang', lang)
    document.documentElement.lang = lang
    emitLanguageChange()
  }, [])

  useEffect(() => {
    localStorage.setItem('uiLang', uiLang)
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
