'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { UiLang } from '@/types'

const BROWSER_LANG: Record<UiLang, string> = {
  en: 'en-LK',
  si: 'si-LK',
  ta: 'ta-LK',
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

function detectSpeechSupport(): boolean {
  if (typeof window === 'undefined') return false
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  return !!SR
}

function subscribeSpeechSupport(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  queueMicrotask(onChange)
  return () => {}
}

export function useSpeech(uiLang: UiLang, onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const supported = useSyncExternalStore(
    subscribeSpeechSupport,
    detectSpeechSupport,
    () => false
  )

  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = BROWSER_LANG[uiLang] || 'en-LK'
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e) => {
      const finalText = Array.from(e.results)
        .filter((r) => r.isFinal)
        .map((r) => r[0]?.transcript ?? '')
        .join(' ')
        .trim()

      if (finalText) onResult(finalText)
    }

    recRef.current = rec
    return () => rec.abort()
  }, [uiLang, onResult])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return

    if (listening) {
      rec.stop()
      return
    }

    rec.lang = BROWSER_LANG[uiLang] || 'en-LK'
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }, [listening, uiLang])

  return { listening, supported, toggle }
}
