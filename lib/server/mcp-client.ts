const MCP_CACHE = new Map<string, { text: string; ts: number }>()
export const CACHE_TTL = 10 * 60 * 1000

const ORDER_MAX_RETRIES = 2
const ORDER_RETRY_BASE_MS = 800

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('rate_limit') ||
    lower.includes('timeout') ||
    lower.includes('internal server error') ||
    lower.includes('service unavailable') ||
    lower.includes('bad gateway') ||
    lower.includes('connection') ||
    lower.startsWith('error') && !lower.includes('city_not_deliverable') &&
    !lower.includes('product_unavailable') &&
    !lower.includes('out_of_stock') &&
    !lower.includes('invalid_date')
  )
}
export const CACHEABLE = new Set([
  'kapruka_search_products',
  'kapruka_get_product',
  'kapruka_list_categories',
  'kapruka_list_delivery_cities',
])

export class KaprukaMCPClient {
  private sessionId: string | null = null
  private msgId = 1
  private ready = false
  private _initPromise: Promise<void> | null = null

  private async _rpc(
    method: string,
    params: Record<string, unknown> = {},
    isNotif = false
  ) {
    const body: Record<string, unknown> = { jsonrpc: '2.0', method, params }
    if (!isNotif) body.id = this.msgId++

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    }
    if (this.sessionId) headers['mcp-session-id'] = this.sessionId

    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 12000)
    let res: Response
    try {
      res = await fetch('https://mcp.kapruka.com/mcp', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const sid = res.headers.get('mcp-session-id')
    if (sid) this.sessionId = sid
    if (isNotif) return null
    if (res.status === 429) return { error: { message: 'rate_limited' } }

    const ct = res.headers.get('content-type') || ''
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split('\n').filter((l) => l.startsWith('data:')).reverse()) {
        try {
          return JSON.parse(line.slice(5).trim())
        } catch {
          /* continue */
        }
      }
      return null
    }
    return res.json()
  }

  async init() {
    if (this.ready) return
    if (!this._initPromise) {
      this._initPromise = (async () => {
        await this._rpc('initialize', {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'kapruka-anu', version: '1' },
        })
        await this._rpc('notifications/initialized', {}, true)
        this.ready = true
      })()
    }
    return this._initPromise
  }

  private extractText(
    result: unknown
  ): string {
    if (
      result &&
      typeof result === 'object' &&
      'error' in result &&
      (result as { error?: { message?: string } }).error?.message ===
        'rate_limited'
    ) {
      return 'RATE_LIMIT: Try again in about 30 seconds.'
    }

    const content = (
      result as { result?: { content?: Array<{ type: string; text: string }> } }
    )?.result?.content
    return Array.isArray(content)
      ? content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
      : JSON.stringify(result)
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const wantsJSON =
      CACHEABLE.has(name) || name === 'kapruka_create_order'
    const callArgs = wantsJSON ? { ...args, response_format: 'json' } : args

    const key = CACHEABLE.has(name)
      ? `${name}:${JSON.stringify(callArgs)}`
      : null
    if (key) {
      const hit = MCP_CACHE.get(key)
      if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.text
    }

    await this.init()

    // For order creation, retry on transient failures
    if (name === 'kapruka_create_order') {
      let lastText = ''
      for (let attempt = 0; attempt <= ORDER_MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = ORDER_RETRY_BASE_MS * Math.pow(2, attempt - 1)
          console.log(`[MCP] Retry ${attempt}/${ORDER_MAX_RETRIES} for ${name} after ${delay}ms`)
          await sleep(delay)
        }
        try {
          const result = await this._rpc('tools/call', {
            name,
            arguments: { params: callArgs },
          })
          lastText = this.extractText(result)
          // If it looks like a real failure that's transient, retry
          if (isRetryableError(lastText) && attempt < ORDER_MAX_RETRIES) {
            console.warn(`[MCP] Transient error on ${name} attempt ${attempt + 1}:`, lastText.slice(0, 200))
            continue
          }
          return lastText
        } catch (err) {
          console.error(`[MCP] ${name} attempt ${attempt + 1} threw:`, err)
          if (attempt >= ORDER_MAX_RETRIES) throw err
        }
      }
      return lastText
    }

    // Normal (non-order) tool call — no retry
    const result = await this._rpc('tools/call', {
      name,
      arguments: { params: callArgs },
    })
    const text = this.extractText(result)

    if (key && !text.startsWith('Error')) {
      MCP_CACHE.set(key, { text, ts: Date.now() })
    }
    return text
  }
}
