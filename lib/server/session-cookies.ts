import { cookies } from 'next/headers'

const isProd = process.env.NODE_ENV === 'production'
const DEVICE_COOKIE = isProd ? '__Host-anu_device_id' : 'anu_device_id'
const SESSION_COOKIE = isProd ? '__Host-anu_session_id' : 'anu_session_id'

export async function getDeviceId(): Promise<string> {
  const jar = await cookies()
  let id = jar.get(DEVICE_COOKIE)?.value
  if (!id) {
    id = crypto.randomUUID()
    jar.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }
  return id
}

export async function getActiveSessionId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value ?? null
}

export async function setActiveSessionId(id: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function clearActiveSessionId(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}
