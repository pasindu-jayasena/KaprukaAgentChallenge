import type { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { sanitizeCreateOrderArgs, sanitizeToolOutput } from '@/lib/server/mcp-order'

const CLAUDE_BASE_URL = process.env.CLAUDE_BASE_URL || 'https://tokenlb.net/v1'
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || ''
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'

// Cost controls
const MAX_TOKENS = 1200 // Room for 4–6 product picks in PRODUCT_TRIO
const HISTORY_CAP = 16 // Send last 16 messages for better memory
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
        description:
          'Search Kapruka catalog ONLY when the customer wants to browse or buy products, including gifts, groceries, electronics, fashion, home items, and daily essentials. Do NOT use for advice questions, comparisons of already-shown items, or general chat.',
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
        description:
          'Create guest checkout. sender: {name} only (no email). delivery: {address,city,date,instructions?} — use instructions not special_instructions.',
        parameters: {
          type: 'object',
          properties: {
            cart: { type: 'array' },
            recipient: {
              type: 'object',
              properties: { name: { type: 'string' }, phone: { type: 'string' } },
            },
            delivery: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                city: { type: 'string' },
                date: { type: 'string' },
                instructions: { type: 'string' },
              },
            },
            sender: {
              type: 'object',
              properties: { name: { type: 'string' }, anonymous: { type: 'boolean' } },
            },
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
      temperature: 0.65,
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
  onOrderPreview?: (args: Record<string, unknown>) => void
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
        const toolArgs =
          name === 'kapruka_create_order' ? sanitizeCreateOrderArgs(args) : args

        if (name === 'kapruka_create_order') {
          opts.onOrderPreview?.(toolArgs)
          claudeMessages.push({
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
