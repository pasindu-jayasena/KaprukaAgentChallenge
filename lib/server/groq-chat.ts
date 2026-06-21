import Groq from 'groq-sdk'
import type { KaprukaMCPClient } from '@/lib/server/mcp-client'

const GROQ_TOOLS = [
  'kapruka_search_products',
  'kapruka_get_product',
  'kapruka_list_categories',
  'kapruka_list_delivery_cities',
  'kapruka_check_delivery',
  'kapruka_create_order',
  'kapruka_track_order',
] as const

function groqToolDefs() {
  return [
    {
      type: 'function' as const,
      function: {
        name: 'kapruka_search_products',
        description: 'Search Kapruka catalog',
        parameters: {
          type: 'object',
          properties: { q: { type: 'string' }, category: { type: 'string' }, max_price: { type: 'number' }, limit: { type: 'number' } },
          required: ['q'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'kapruka_get_product',
        description: 'Get product by ID',
        parameters: { type: 'object', properties: { product_id: { type: 'string' } }, required: ['product_id'] },
      },
    },
    {
      type: 'function' as const,
      function: { name: 'kapruka_list_categories', description: 'List categories', parameters: { type: 'object', properties: {} } },
    },
    {
      type: 'function' as const,
      function: {
        name: 'kapruka_list_delivery_cities',
        description: 'Search delivery cities',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'kapruka_check_delivery',
        description: 'Check delivery',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' }, delivery_date: { type: 'string' }, product_id: { type: 'string' } },
          required: ['city', 'delivery_date'],
        },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'kapruka_create_order',
        description: 'Create order',
        parameters: { type: 'object', properties: { cart: { type: 'array' }, recipient: { type: 'object' }, delivery: { type: 'object' }, sender: { type: 'object' }, gift_message: { type: 'string' } } },
      },
    },
    {
      type: 'function' as const,
      function: {
        name: 'kapruka_track_order',
        description: 'Track order',
        parameters: { type: 'object', properties: { order_number: { type: 'string' } }, required: ['order_number'] },
      },
    },
  ]
}

export function isGeminiQuotaError(e: unknown): boolean {
  const err = e as { status?: number; message?: string }
  return err?.status === 429 || (err?.message?.includes('429') ?? false) || (err?.message?.includes('quota') ?? false)
}

export async function runGroqChat(opts: {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  mcp: KaprukaMCPClient
  onStatus: (name: string, args: Record<string, unknown>) => void
  onOrderResult?: (result: { url: string | null; ref: string | null; expiresAt: string | null }) => void
}): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not configured')

  const groq = new Groq({ apiKey: key })
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: opts.systemPrompt },
    ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  let iterations = 0
  while (iterations < 4) {
    iterations++
    const completion = await groq.chat.completions.create({
      model,
      messages: groqMessages,
      tools: groqToolDefs(),
      temperature: 0.7,
    })

    const msg = completion.choices[0]?.message
    if (!msg) throw new Error('Empty Groq response')

    if (msg.tool_calls?.length) {
      groqMessages.push(msg)
      for (const call of msg.tool_calls) {
        const name = call.function.name
        if (!GROQ_TOOLS.includes(name as (typeof GROQ_TOOLS)[number])) continue
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        } catch {
          /* empty */
        }
        opts.onStatus(name, args)
        const output = await opts.mcp.callTool(name, args)
        if (name === 'kapruka_create_order') {
          try {
            const j = JSON.parse(output) as {
              checkout_url?: string
              order_ref?: string
              expires_at?: string
            }
            opts.onOrderResult?.({
              url: j.checkout_url ?? null,
              ref: j.order_ref ?? null,
              expiresAt: j.expires_at ?? null,
            })
          } catch {
            /* ignore */
          }
        }
        groqMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      }
      continue
    }

    return msg.content ?? ''
  }

  return 'That took a bit long — try again in a moment.'
}
