import { Redis } from '@upstash/redis'
import type { SessionRecord } from '@/types'

const SESSION_TTL = 60 * 60 * 24 * 30 // 30 days
const MAX_SESSIONS = 10

// In-memory fallback — persist on globalThis so dev/hot-reload keeps sessions
type MemoryStore = {
  sessions: Map<string, SessionRecord>
  deviceIndex: Map<string, string[]>
}
const memoryStore: MemoryStore =
  (globalThis as unknown as { __anuSessionStore?: MemoryStore }).__anuSessionStore ??
  ((globalThis as unknown as { __anuSessionStore: MemoryStore }).__anuSessionStore = {
    sessions: new Map(),
    deviceIndex: new Map(),
  })
const memorySessions = memoryStore.sessions
const memoryDeviceIndex = memoryStore.deviceIndex

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function sessionKey(id: string) {
  return `session:${id}`
}

function deviceKey(deviceId: string) {
  return `device:${deviceId}`
}

export async function listSessions(deviceId: string): Promise<SessionRecord[]> {
  const redis = getRedis()
  if (!redis) {
    const ids = memoryDeviceIndex.get(deviceId) ?? []
    return ids
      .map((id) => memorySessions.get(id))
      .filter((s): s is SessionRecord => !!s)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SESSIONS)
  }

  const ids = (await redis.zrange<string[]>(deviceKey(deviceId), 0, MAX_SESSIONS - 1, {
    rev: true,
  })) ?? []

  const sessions = await Promise.all(
    ids.map(async (id) => {
      const raw = await redis.get<string>(sessionKey(id))
      if (!raw) return null
      return typeof raw === 'string' ? (JSON.parse(raw) as SessionRecord) : (raw as SessionRecord)
    })
  )
  return sessions.filter((s): s is SessionRecord => !!s)
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const redis = getRedis()
  if (!redis) return memorySessions.get(id) ?? null

  const raw = await redis.get<string>(sessionKey(id))
  if (!raw) return null
  return typeof raw === 'string' ? (JSON.parse(raw) as SessionRecord) : (raw as SessionRecord)
}

export async function saveSession(deviceId: string, session: SessionRecord): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    memorySessions.set(session.id, session)
    const ids = memoryDeviceIndex.get(deviceId) ?? []
    const next = [session.id, ...ids.filter((x) => x !== session.id)].slice(0, MAX_SESSIONS)
    memoryDeviceIndex.set(deviceId, next)
    return
  }

  await redis.set(sessionKey(session.id), JSON.stringify(session), { ex: SESSION_TTL })
  await redis.zadd(deviceKey(deviceId), {
    score: new Date(session.updatedAt).getTime(),
    member: session.id,
  })
  await redis.expire(deviceKey(deviceId), SESSION_TTL)
}

export async function deleteSession(deviceId: string, id: string): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    memorySessions.delete(id)
    const ids = memoryDeviceIndex.get(deviceId) ?? []
    memoryDeviceIndex.set(
      deviceId,
      ids.filter((x) => x !== id)
    )
    return
  }

  await redis.del(sessionKey(id))
  await redis.zrem(deviceKey(deviceId), id)
}

export function newSessionId(): string {
  return crypto.randomUUID()
}
