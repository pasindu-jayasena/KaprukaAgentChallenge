import type { KaprukaMCPClient } from '@/lib/server/mcp-client'
import type { OrderResult } from '@/types'

const CLAUDE_BASE_URL = process.env.CLAUDE_BASE_URL || 'https://tokenlb.net/v1'
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || ''
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'

// Cost controls
const MAX_TOKENS = 800 // Keep responses concise & cheap
const HISTORY_CAP = 8 // Send only last 8 messages to reduce token usage
const MAX_TOOL_ITERATIONS = 8

interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

function claudeToolDefs(): ToolDef[] {
  return [
    {
      type: 'function',
      function: {
        name: 'kapruka_search_products',
        description: 'Search Kapruka product catalog by keyword, category, or price range',
        parameters: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Search query' },
            category: { type: 'string', description: 'Category filter' },
            max_price: { type: 'number', description: 'Maximum price in LKR' },
            limit: { type: 'number', description: 'Max results (default 5)' },
          },
          required: ['q'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kapruka_get_product',
        description: 'Get detailed product info by product ID',
        parameters: {
          type: 'object',
          properties: { product_id: { type: 'string' } },
          required: ['product_id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kapruka_list_categories',
        description: 'List all available product categories',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kapruka_list_delivery_cities',
        description: 'Search for delivery cities by name',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kapruka_check_delivery',
        description: 'Check delivery availability for a city and date',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            delivery_date: { type: 'string' },
            product_id: { type: 'string' },
          },
          required: ['city', 'delivery_date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'kapruka_create_order',
        description: 'Create a guest checkout order',
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
      type: 'function',
      function: {
        name: 'kapruka_track_order',
        description: 'Track an existing order by order number',
        parameters: {
          type: 'object',
          properties: { order_number: { type: 'string' } },
          required: ['order_number'],
        },
      },
    },
  ]
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface CompletionResponse {
  choices: Array<{
    message: {
      role: string
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

async function callClaude(messages: ChatMessage[]): Promise<CompletionResponse> {
  const res = await fetch(`${CLAUDE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CLAUDE_API_KEY}`,
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      messages,
      tools: claudeToolDefs(),
      max_tokens: MAX_TOKENS,
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(45000),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Claude API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  return res.json() as Promise<CompletionResponse>
}

export function isClaudeAvailable(): boolean {
  return !!CLAUDE_API_KEY
}

export function isClaudeQuotaError(e: unknown): boolean {
  const err = e as { message?: string }
  return (
    err?.message?.includes('429') ??
    err?.message?.includes('quota') ??
    err?.message?.includes('rate') ??
    false
  )
}

export async function runClaudeChat(opts: {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  mcp: KaprukaMCPClient
  onStatus: (name: string, args: Record<string, unknown>) => void
  onOrderResult?: (result: OrderResult) => void
}): Promise<string> {
  // Build messages with history cap for cost control
  const trimmedHistory = opts.messages.slice(-HISTORY_CAP)

  const claudeMessages: ChatMessage[] = [
    { role: 'system', content: opts.systemPrompt },
    ...trimmedHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  let iterations = 0
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++
    const completion = await callClaude(claudeMessages)
    const msg = completion.choices[0]?.message

    if (!msg) throw new Error('Empty Claude response')

    // Log token usage for cost monitoring
    if (completion.usage) {
      console.log(
        `[Claude] tokens: prompt=${completion.usage.prompt_tokens} completion=${completion.usage.completion_tokens} total=${completion.usage.total_tokens}`
      )
    }

    if (msg.tool_calls?.length) {
      // Push assistant message with tool calls
      claudeMessages.push({
        role: 'assistant',
        content: msg.content ?? '',
        tool_calls: msg.tool_calls,
      })

      // Execute each tool call
      for (const call of msg.tool_calls) {
        const name = call.function.name
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        } catch {
          /* empty args */
        }

        opts.onStatus(name, args)
        const output = await opts.mcp.callTool(name, args)

        // Check for order results
        if (name === 'kapruka_create_order') {
          try {
            const j = JSON.parse(output) as {
              checkout_url?: string
              order_ref?: string
              expires_at?: string
            }
            if (j.checkout_url || j.order_ref) {
              opts.onOrderResult?.({
                url: j.checkout_url ?? null,
                ref: j.order_ref ?? null,
                expiresAt: j.expires_at ?? null,
              })
            }
          } catch {
            /* not json */
          }
        }

        claudeMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      }
      continue
    }

    // No tool calls — return the text response
    return msg.content ?? ''
  }

  return "That took a bit long — let me try again. What were you looking for?"
}
