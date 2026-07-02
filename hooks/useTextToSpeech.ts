'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { UiLang } from '@/types'

const SPEECH_LANG: Record<UiLang, string> = {
  en: 'en-LK',
  si: 'si-LK',
  ta: 'ta-LK',
}

function detectTtsSupport(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

function subscribeTtsSupport(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  queueMicrotask(onChange)
  return () => {}
}

function pickVoice(lang: string) {
  if (typeof window === 'undefined') return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ??
    null
  )
}

export function useTextToSpeech(uiLang: UiLang) {
  const supported = useSyncExternalStore(
    subscribeTtsSupport,
    detectTtsSupport,
    () => false
  )
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  useEffect(() => {
    if (!supported || typeof window === 'undefined') return
    const clear = () => setSpeakingId(null)
    window.speechSynthesis.addEventListener?.('voiceschanged', clear)
    return () => {
      window.speechSynthesis.cancel()
      window.speechSynthesis.removeEventListener?.('voiceschanged', clear)
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported || typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [supported])

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported || typeof window === 'undefined') return
      const trimmed = text.replace(/\s+/g, ' ').trim()
      if (!trimmed) return

      if (speakingId === id && window.speechSynthesis.speaking) {
        stop()
        return
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(trimmed)
      utterance.lang = SPEECH_LANG[uiLang] || 'en-LK'
      utterance.voice = pickVoice(utterance.lang)
      utterance.rate = 1
      utterance.pitch = 1
      utterance.onend = () => setSpeakingId(null)
      utterance.onerror = () => setSpeakingId(null)
      setSpeakingId(id)
      window.speechSynthesis.speak(utterance)
    },
    [speakingId, stop, supported, uiLang]
  )

  return { supported, speakingId, speak, stop }
}
