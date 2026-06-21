import { NextResponse } from 'next/server'
import { getDeviceId } from '@/lib/server/session-cookies'
import { getSession, saveSession, deleteSession } from '@/lib/server/session-store'
import type { SessionRecord } from '@/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession(id)
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ session })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deviceId = await getDeviceId()
  const existing = await getSession(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch = (await req.json()) as Partial<SessionRecord>
  const session: SessionRecord = {
    ...existing,
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  }

  await saveSession(deviceId, session)
  return NextResponse.json({ session })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deviceId = await getDeviceId()
  await deleteSession(deviceId, id)
  return NextResponse.json({ ok: true })
}
