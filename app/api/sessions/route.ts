import { NextResponse } from 'next/server'
import {
  getDeviceId,
  setActiveSessionId,
  getActiveSessionId,
} from '@/lib/server/session-cookies'
import {
  listSessions,
  saveSession,
  newSessionId,
} from '@/lib/server/session-store'
import { ANU_GREETINGS } from '@/config/site'
import type { SessionRecord } from '@/types'

export async function GET() {
  const deviceId = await getDeviceId()
  const sessions = await listSessions(deviceId)
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      preview: s.preview,
      productCount: s.productCount,
      thumbnailUrl: s.thumbnailUrl,
      updatedAt: s.updatedAt,
    })),
  })
}

export async function POST(req: Request) {
  const deviceId = await getDeviceId()
  let title = 'New chat'
  try {
    const body = (await req.json()) as { title?: string }
    if (body.title) title = body.title.slice(0, 80)
  } catch {
    /* default title */
  }

  const id = newSessionId()
  const now = new Date().toISOString()
  const session: SessionRecord = {
    id,
    title,
    preview: '',
    productCount: 0,
    thumbnailUrl: null,
    updatedAt: now,
    messages: [{ role: 'assistant', content: ANU_GREETINGS.en }],
    journeyStep: 0,
  }

  await saveSession(deviceId, session)
  await setActiveSessionId(id)

  return NextResponse.json({ id, session })
}
