// Production-grade rate limiter with memory cleanup
const RL = new Map<string, { count: number; windowStart: number }>()
const RL_WINDOW = 5 * 60 * 1000 // 5 minutes
const RL_MAX = 15 // 15 requests per 5 minutes per IP (production-safe)
const CLEANUP_INTERVAL = 10 * 60 * 1000 // Clean stale entries every 10 min

// Periodic cleanup to prevent memory leaks in long-running processes
let lastCleanup = Date.now()
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of RL.entries()) {
    if (now - entry.windowStart > RL_WINDOW * 2) {
      RL.delete(key)
    }
  }
}

export function rateLimited(ip: string): boolean {
  cleanup()
  const now = Date.now()
  const e = RL.get(ip)
  if (!e || now - e.windowStart > RL_WINDOW) {
    RL.set(ip, { count: 1, windowStart: now })
    return false
  }
  e.count++
  return e.count > RL_MAX
}
