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
  read: (id: string, text: string, lang?: UiLang) => void
  stop: () => void
  prime: () => void
}

const VoiceOutputContext = createContext<VoiceOutputContextValue | null>(null)

const UNMUTE_CONFIRMATION: Record<UiLang, string> = {
  en: 'Voice on! I will read my replies out loud.',
  si: 'හරි, මම දැන් උත්තර කියවන්නම්!',
  ta: 'சரி, இனி என் பதில்களை வாசிக்கிறேன்!',
}

export function VoiceOutputProvider({
  uiLang,
  children,
}: {
  uiLang: UiLang
  children: ReactNode
}) {
  const [muted, setMuted] = useState(true)
  const { supported, speakingId, speak, stop, prime } = useTextToSpeech(uiLang)

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current
      if (next) {
        stop()
      } else {
        // Unmuting happens inside the header tap — that user gesture unlocks
        // audio on mobile, and the spoken confirmation proves sound works.
        prime()
        speak(`voice-on-${Date.now()}`, UNMUTE_CONFIRMATION[uiLang] ?? UNMUTE_CONFIRMATION.en, uiLang)
      }
      return next
    })
  }, [stop, prime, speak, uiLang])

  const read = useCallback(
    (id: string, text: string, lang?: UiLang) => {
      if (muted) return
      speak(id, text, lang)
    },
    [muted, speak]
  )

  const value = useMemo(
    () => ({ supported, muted, speakingId, toggleMuted, read, stop, prime }),
    [muted, read, speakingId, stop, supported, toggleMuted, prime]
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
      prime: () => {},
    }
  }
  return value
}
