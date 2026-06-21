'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

export function useSpeech(uiLang: UiLang, onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const recRef = useRef<SpeechRecognition | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const modeRef = useRef<'groq' | 'browser'>('groq')

  useEffect(() => {
    const canRecord =
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition

    if (canRecord) {
      modeRef.current = 'groq'
      setSupported(true)
    } else if (SR) {
      modeRef.current = 'browser'
      setSupported(true)
      const rec = new SR()
      rec.continuous = false
      rec.interimResults = true
      rec.onstart = () => setListening(true)
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      rec.onresult = (e) => {
        const text = Array.from(e.results)
          .map((r) => r[0].transcript)
          .join('')
        onResult(text)
      }
      recRef.current = rec
      return () => rec.abort()
    }
  }, [onResult])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const transcribeWithGroq = useCallback(
    async (blob: Blob) => {
      setTranscribing(true)
      try {
        const form = new FormData()
        form.append('file', blob, 'audio.webm')
        form.append('language', uiLang)

        const res = await fetch('/api/transcribe', { method: 'POST', body: form })
        if (!res.ok) throw new Error('transcribe failed')

        const data = (await res.json()) as { text?: string }
        if (data.text) onResult(data.text)
      } catch {
        /* fallback below */
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SR) {
          modeRef.current = 'browser'
          const rec = new SR()
          rec.continuous = false
          rec.interimResults = false
          rec.lang = BROWSER_LANG[uiLang] || 'en-LK'
          rec.onresult = (e) => {
            const text = Array.from(e.results)
              .map((r) => r[0].transcript)
              .join('')
            onResult(text)
          }
          rec.start()
        }
      } finally {
        setTranscribing(false)
        setListening(false)
      }
    },
    [uiLang, onResult]
  )

  const startGroqRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stopStream()
        if (blob.size > 0) transcribeWithGroq(blob)
        else setListening(false)
      }

      recorder.start()
      setListening(true)
    } catch {
      setListening(false)
      stopStream()
    }
  }, [stopStream, transcribeWithGroq])

  const stopGroqRecording = useCallback(() => {
    const rec = mediaRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    else setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (transcribing) return

    if (modeRef.current === 'groq') {
      if (listening) stopGroqRecording()
      else startGroqRecording()
      return
    }

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
  }, [listening, transcribing, uiLang, startGroqRecording, stopGroqRecording])

  return { listening: listening || transcribing, supported, toggle }
}
