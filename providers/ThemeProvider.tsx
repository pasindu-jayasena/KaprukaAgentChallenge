'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('anu-theme') as Theme | null
    const initial =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    setThemeState(initial)
    document.documentElement.dataset.theme = initial
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('anu-theme', t)
    document.documentElement.dataset.theme = t
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
