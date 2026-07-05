'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

// Voices load asynchronously (especially on Android/Chrome) — cache the last
// non-empty list so a momentary empty getVoices() doesn't leave us silent.
let cachedVoices: SpeechSynthesisVoice[] = []

function refreshVoices(): SpeechSynthesisVoice[] {
  if (!detectTtsSupport()) return []
  const voices = window.speechSynthesis.getVoices()
  if (voices.length) cachedVoices = voices
  return cachedVoices
}

function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = refreshVoices()
    if (existing.length) {
      resolve(existing)
      return
    }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener?.('voiceschanged', finish)
      resolve(refreshVoices())
    }
    window.speechSynthesis.addEventListener?.('voiceschanged', finish)
    setTimeout(finish, timeoutMs)
  })
}

const VOICE_NAME_HINTS: Record<string, RegExp> = {
  si: /sinhala|sri ?lanka/i,
  ta: /tamil/i,
  en: /english/i,
}

/**
 * Fallback chain: exact lang → same language prefix → voice name hint →
 * null (utterance.lang alone still lets the OS engine route the language).
 */
function pickVoice(lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const prefix = lang.slice(0, 2).toLowerCase()
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    voices.find((v) => VOICE_NAME_HINTS[prefix]?.test(v.name)) ??
    null
  )
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_`#>~|]/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Long utterances get truncated on Android and stall on desktop Chrome —
// speak in sentence-sized chunks instead.
function chunkText(text: string, max = 180): string[] {
  const chunks: string[] = []
  let rest = text
  while (rest.length > max) {
    const head = rest.slice(0, max)
    let cut = -1
    for (const m of head.matchAll(/[.!?…]\s+|,\s+|\s+/g)) {
      cut = (m.index ?? 0) + m[0].length
    }
    if (cut <= 0) cut = max
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks.filter(Boolean)
}

export function useTextToSpeech(uiLang: UiLang) {
  const supported = useSyncExternalStore(
    subscribeTtsSupport,
    detectTtsSupport,
    () => false
  )
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const speakSession = useRef(0)

  useEffect(() => {
    if (!supported || typeof window === 'undefined') return
    const onVoicesChanged = () => refreshVoices()
    refreshVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesChanged)
    return () => {
      window.speechSynthesis.cancel()
      window.speechSynthesis.removeEventListener?.('voiceschanged', onVoicesChanged)
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported || typeof window === 'undefined') return
    speakSession.current += 1
    window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [supported])

  /**
   * Warm up the speech engine inside a user gesture (header unmute tap,
   * send tap). Mobile browsers block speech that isn't tied to a gesture —
   * a zero-volume utterance here unlocks later programmatic speech.
   */
  const prime = useCallback(() => {
    if (!supported || typeof window === 'undefined') return
    try {
      window.speechSynthesis.resume()
      refreshVoices()
      const warmup = new SpeechSynthesisUtterance(' ')
      warmup.volume = 0
      window.speechSynthesis.speak(warmup)
    } catch {
      /* best effort */
    }
  }, [supported])

  const speak = useCallback(
    (id: string, text: string, langOverride?: UiLang) => {
      if (!supported || typeof window === 'undefined') return
      const cleaned = cleanForSpeech(text)
      if (!cleaned) return

      if (speakingId === id && window.speechSynthesis.speaking) {
        stop()
        return
      }

      const session = ++speakSession.current
      window.speechSynthesis.cancel()
      // Chrome can get stuck in a paused state after cancel — resume defensively
      window.speechSynthesis.resume()
      const langCode = SPEECH_LANG[langOverride ?? uiLang] || 'en-LK'
      setSpeakingId(id)

      void (async () => {
        const voices = await waitForVoices()
        if (speakSession.current !== session) return
        const voice = pickVoice(langCode, voices)
        const chunks = chunkText(cleaned)
        let index = 0

        const speakNext = () => {
          if (speakSession.current !== session) return
          if (index >= chunks.length) {
            setSpeakingId(null)
            return
          }
          const utterance = new SpeechSynthesisUtterance(chunks[index++])
          utterance.lang = langCode
          if (voice) utterance.voice = voice
          utterance.rate = 1
          utterance.pitch = 1
          utterance.onend = speakNext
          // Skip a failed chunk instead of going silent for the rest
          utterance.onerror = speakNext
          window.speechSynthesis.speak(utterance)
        }
        speakNext()
      })()
    },
    [speakingId, stop, supported, uiLang]
  )

  return { supported, speakingId, speak, stop, prime }
}
