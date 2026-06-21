export const runtime = 'nodejs'

const WHISPER_LANG: Record<string, string> = {
  en: 'en',
  si: 'si',
  ta: 'ta',
}

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    return Response.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
  }

  try {
    const incoming = await req.formData()
    const file = incoming.get('file')
    const uiLang = (incoming.get('language') as string) || 'en'

    if (!file || !(file instanceof Blob)) {
      return Response.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const body = new FormData()
    body.append('file', file, 'audio.webm')
    body.append('model', 'whisper-large-v3-turbo')
    body.append('response_format', 'json')
    const whisperLang = WHISPER_LANG[uiLang]
    if (whisperLang) body.append('language', whisperLang)

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body,
    })

    if (!res.ok) {
      const detail = await res.text()
      return Response.json(
        { error: 'Transcription failed', detail: detail.slice(0, 200) },
        { status: res.status }
      )
    }

    const data = (await res.json()) as { text?: string }
    return Response.json({ text: (data.text ?? '').trim() })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Transcription error' },
      { status: 500 }
    )
  }
}
