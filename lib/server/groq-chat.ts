import Groq from 'groq-sdk'
import type { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { sanitizeCreateOrderArgs, sanitizeToolOutput } from '@/lib/server/mcp-order'

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
        description:
          'Search Kapruka catalog ONLY when the customer wants to browse or buy. Skip for advice, emotional support, or comparing items already shown. Use short concrete product nouns for q ("shoes", "sandals") — never umbrella words like "footwear"; retry with synonyms before saying something is unavailable.',
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
        description: 'Call this to confirm the city/date is actually deliverable BEFORE showing a PLAN_BOARD. If unavailable, tell the customer and ask for a different date instead of proceeding.',
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
        description:
          'Create order. sender{name} only. delivery{address,city,date,instructions?}',
        parameters: {
          type: 'object',
          properties: {
            cart: { type: 'array' },
            recipient: { type: 'object' },
            delivery: { type: 'object' },
            sender: { type: 'object' },
            gift_message: { type: 'string' },
          },
          required: ['cart', 'recipient', 'delivery', 'sender'],
        },
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
  onOrderPreview?: (args: Record<string, unknown>) => void
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
  while (iterations < 8) {
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
        const toolArgs =
          name === 'kapruka_create_order' ? sanitizeCreateOrderArgs(args) : args

        if (name === 'kapruka_create_order') {
          opts.onOrderPreview?.(toolArgs)
          groqMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              status: 'preview_shown',
              message:
                'Order review card shown to the customer. They must tap Confirm before the payment link is generated.',
            }),
          })
          continue
        }

        const output = sanitizeToolOutput(
          name,
          await opts.mcp.callTool(name, toolArgs)
        )
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
