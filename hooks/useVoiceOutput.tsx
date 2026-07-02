'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { UiLang } from '@/types'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'

interface VoiceOutputContextValue {
  supported: boolean
  muted: boolean
  speakingId: string | null
  toggleMuted: () => void
  read: (id: string, text: string) => void
  stop: () => void
}

const VoiceOutputContext = createContext<VoiceOutputContextValue | null>(null)

export function VoiceOutputProvider({
  uiLang,
  children,
}: {
  uiLang: UiLang
  children: ReactNode
}) {
  const [muted, setMuted] = useState(true)
  const { supported, speakingId, speak, stop } = useTextToSpeech(uiLang)

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current
      if (next) stop()
      return next
    })
  }, [stop])

  const read = useCallback(
    (id: string, text: string) => {
      if (muted) return
      speak(id, text)
    },
    [muted, speak]
  )

  const value = useMemo(
    () => ({ supported, muted, speakingId, toggleMuted, read, stop }),
    [muted, read, speakingId, stop, supported, toggleMuted]
  )

  return <VoiceOutputContext.Provider value={value}>{children}</VoiceOutputContext.Provider>
}

export function useVoiceOutput() {
  const value = useContext(VoiceOutputContext)
  if (!value) {
    return {
      supported: false,
      muted: true,
      speakingId: null,
      toggleMuted: () => {},
      read: () => {},
      stop: () => {},
    }
  }
  return value
}
