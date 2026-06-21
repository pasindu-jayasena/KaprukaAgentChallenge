const MCP_CACHE = new Map<string, { text: string; ts: number }>()
export const CACHE_TTL = 10 * 60 * 1000
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
    const result = await this._rpc('tools/call', {
      name,
      arguments: { params: callArgs },
    })
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
    const text = Array.isArray(content)
      ? content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
      : JSON.stringify(result)

    if (key && !text.startsWith('Error')) {
      MCP_CACHE.set(key, { text, ts: Date.now() })
    }
    return text
  }
}
