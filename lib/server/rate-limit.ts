import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Per-route rate limiting keyed by device cookie (falling back to IP).
 * Fails OPEN when Upstash env vars are absent (e.g. local dev) so the app
 * keeps working — production on Vercel has the env configured.
 */

type LimiterName = 'chat' | 'checkout'

const LIMITS: Record<LimiterName, { requests: number; window: `${number} s` }> = {
  chat: { requests: 20, window: '60 s' },
  checkout: { requests: 6, window: '60 s' },
}

const limiters = new Map<LimiterName, Ratelimit>()

function getLimiter(name: LimiterName): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  let limiter = limiters.get(name)
  if (!limiter) {
    const cfg = LIMITS[name]
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
      prefix: `ratelimit:${name}`,
    })
    limiters.set(name, limiter)
  }
  return limiter
}

export function clientKeyFromRequest(req: Request, deviceId?: string | null): string {
  if (deviceId && deviceId !== 'anonymous') return `device:${deviceId}`
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

/** Returns true when the request is allowed. Fails open on any limiter error. */
export async function checkRateLimit(
  name: LimiterName,
  key: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const limiter = getLimiter(name)
  if (!limiter) return { allowed: true }
  try {
    const result = await limiter.limit(key)
    if (result.success) return { allowed: true }
    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
    return { allowed: false, retryAfterSeconds }
  } catch (err) {
    console.error(`[rate-limit] ${name} check failed, allowing request:`, err)
    return { allowed: true }
  }
}
