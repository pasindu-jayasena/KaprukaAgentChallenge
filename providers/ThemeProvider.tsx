'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'

export type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}>({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
})

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem('anu-theme')
  return stored === 'dark' ? 'dark' : 'light'
}

const themeListeners = new Set<() => void>()

function subscribeTheme(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  themeListeners.add(onChange)
  queueMicrotask(onChange)
  return () => themeListeners.delete(onChange)
}

function emitThemeChange() {
  themeListeners.forEach((listener) => listener())
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readStoredTheme, () => 'light')

  useEffect(() => {
    localStorage.setItem('anu-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem('anu-theme', t)
    document.documentElement.dataset.theme = t
    emitThemeChange()
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
