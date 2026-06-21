import { buildSystemPrompt } from '@/lib/prompts/anu-system'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { runClaudeChat, isClaudeAvailable, isClaudeQuotaError } from '@/lib/server/claude-chat'
import { runGroqChat } from '@/lib/server/groq-chat'
import { chatRequestSchema } from '@/schemas/chat-request'
import { getDeviceId } from '@/lib/server/session-cookies'
import { getProfile, updateProfile } from '@/lib/server/user-memory'
import { getCheckoutPreview } from '@/lib/checkout-preview'
import { orderArgsToCheckoutDetails } from '@/lib/order-args'
import { parseCheckoutDetails } from '@/lib/parse-checkout-details'
import { messagesForModel } from '@/lib/conversation-context'
import { isNonShoppingTurn } from '@/lib/chat-intent'
import { sanitizeAssistantText } from '@/lib/server/mcp-order'
import type { CartItem, ChatPayload, CheckoutDetailsInput } from '@/types'

export const maxDuration = 60
export const runtime = 'nodejs'

function statusLabel(name: string, args: Record<string, unknown> = {}) {
  switch (name) {
    case 'kapruka_search_products':
      return {
        icon: 'search',
        key: 'search',
        label: `Searching "${args.q || '…'}"`,
      }
    case 'kapruka_check_delivery':
      return {
        icon: 'truck',
        key: 'delivery',
        label: `Checking delivery to ${args.city || '…'}`,
      }
    case 'kapruka_create_order':
      return { icon: 'lock', key: 'order', label: 'Locking in your order' }
    case 'kapruka_track_order':
      return { icon: 'compass', key: 'track', label: 'Tracking order' }
    default:
      return { icon: 'sparkles', key: 'working', label: 'Working on it' }
  }
}

function cleanJSON(raw: string) {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
}

function parseBlock(text: string, tag: string) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!m) return { found: false, data: null }
  try {
    return { found: true, data: JSON.parse(cleanJSON(m[1])) }
  } catch {
    return { found: true, data: null }
  }
}

function stripBlocks(text: string) {
  return text
    .replace(/<PRODUCT_TRIO>[\s\S]*?<\/PRODUCT_TRIO>/gi, '')
    .replace(/<PLAN_BOARD>[\s\S]*?<\/PLAN_BOARD>/gi, '')
    .replace(/<CHIPS>[\s\S]*?<\/CHIPS>/gi, '')
    .replace(/<ORDER_TRACKING>[\s\S]*?<\/ORDER_TRACKING>/gi, '')
    .replace(/<function[\s\S]*?<\/function>/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/CHECKOUT_DETAILS:[\s\S]*?(?=\n\n|$)/gi, '')
    .trim()
}

function parseChips(text: string): string[] | null {
  const m = text.match(/<CHIPS>([\s\S]*?)<\/CHIPS>/i)
  if (!m) return null
  try {
    const arr = JSON.parse(cleanJSON(m[1]))
    return Array.isArray(arr) ? arr.slice(0, 5).map(String) : null
  } catch {
    return null
  }
}

function buildPayload(fullText: string): ChatPayload {
  const text = fullText
  const chips = parseChips(text) ?? undefined

  const trio = parseBlock(text, 'PRODUCT_TRIO')
  if (trio.data) {
    const rawText = stripBlocks(text)
    return { type: 'product_trio', trio: trio.data, rawText: rawText || undefined, chips }
  }

  const plan = parseBlock(text, 'PLAN_BOARD')
  if (plan.data) return { type: 'plan_board', plan: plan.data, chips }

  const tracking = parseBlock(text, 'ORDER_TRACKING')
  if (tracking.data) {
    return {
      type: 'order_tracking',
      tracking: tracking.data,
      chips,
    }
  }

  return {
    type: 'chat',
    text: stripBlocks(text) || 'Could you rephrase that?',
    chips,
  }
}

function buildOrderPreviewPayload(
  cart: CartItem[],
  details: CheckoutDetailsInput,
  preview: Awaited<ReturnType<typeof getCheckoutPreview>>,
  text?: string
): ChatPayload {
  return {
    type: 'order_preview',
    text:
      text ??
      'Please review your order below — when everything looks good, tap Confirm to get your Kapruka payment link.',
    details,
    items: cart.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
    })),
    subtotal: preview.subtotal,
    deliveryFee: preview.deliveryFee,
    total: preview.total,
    deliveryNote: preview.deliveryNote,
  }
}

export async function POST(req: Request) {
  const hasClaude = isClaudeAvailable()
  const hasGroq = !!process.env.GROQ_API_KEY
  if (!hasClaude && !hasGroq) {
    return new Response(
      JSON.stringify({
        type: 'final',
        payload: {
          type: 'chat',
          text: 'Anu is not configured yet. Add CLAUDE_API_KEY or GROQ_API_KEY to .env.local.',
        },
      }) + '\n',
      { status: 500, headers: { 'Content-Type': 'application/x-ndjson' } }
    )
  }

  // Parse & validate request
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    console.error('Chat API validation failed:', parsed.error)
    return new Response('Invalid request', { status: 400 })
  }

  const { messages, uiLang, chatLang, cartItems, savedProfiles } = parsed.data
  if (!messages.length) return new Response('No messages', { status: 400 })

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  const checkoutDetails = lastUserMessage
    ? parseCheckoutDetails(lastUserMessage.content)
    : null

  const cart: CartItem[] = (cartItems ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    price: i.price,
    image: null,
    url: null,
    quantity: i.quantity,
    giftMessage: i.giftMessage ?? undefined,
    icingText: i.icingText ?? undefined,
  }))

  // Load user profile for personalized context
  let deviceId = 'anonymous'
  try {
    deviceId = await getDeviceId()
  } catch {
    // Cookie access may fail in some contexts
  }
  const userProfile = getProfile(deviceId)

  // Update chat style from detected language
  updateProfile(deviceId, { chatStyle: chatLang, returningUser: true })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      emit({ type: 'heartbeat' })
      const heartbeatTimer = setInterval(() => {
        try {
          emit({ type: 'heartbeat' })
        } catch {
          /* closed */
        }
      }, 6000)

      try {
        const mcp = new KaprukaMCPClient()
        const systemPrompt = buildSystemPrompt(
          cart,
          uiLang,
          chatLang,
          userProfile,
          savedProfiles?.map((p) => ({
            senderName: p.senderName,
            senderEmail: p.senderEmail,
            recipient: p.recipient,
            giftMessage: p.giftMessage ?? undefined,
            specialInstructions: p.specialInstructions ?? undefined,
          })) ?? null,
          messages
        )
        let pendingOrderArgs: Record<string, unknown> | null = null
        let responseText = ''

        // Structured checkout from chat — show review card first, not payment slip
        if (checkoutDetails && cart.length > 0) {
          emit({
            type: 'status',
            icon: 'search',
            key: 'delivery',
            label: 'Checking delivery fee',
          })
          try {
            const preview = await getCheckoutPreview(cart, checkoutDetails)
            emit({
              type: 'final',
              payload: buildOrderPreviewPayload(cart, checkoutDetails, preview),
            })
            clearInterval(heartbeatTimer)
            controller.close()
            return
          } catch (previewErr) {
            console.error('Checkout preview error:', previewErr)
            emit({
              type: 'final',
              payload: {
                type: 'chat',
                text: 'I could not load your order summary. Please check your details and try again.',
              },
            })
            clearInterval(heartbeatTimer)
            controller.close()
            return
          }
        }

        const onOrderPreview = (args: Record<string, unknown>) => {
          pendingOrderArgs = args
        }

        const onStatus = (name: string, args: Record<string, unknown>) => {
          emit({ type: 'status', ...statusLabel(name, args) })
        }

        const modelMessages = messagesForModel(messages)

        // Primary: Claude via tokenlb.net (skip if order already created from form)
        let usedBackup = false
        if (hasClaude) {
          try {
            responseText = await runClaudeChat({
              systemPrompt,
              messages: modelMessages,
              mcp,
              onStatus,
              onOrderPreview,
            })
          } catch (claudeErr) {
            console.error('[Claude Error]', claudeErr)
            if (!hasGroq || !isClaudeQuotaError(claudeErr)) {
              // Non-quota error and no backup — throw
              if (!hasGroq) throw claudeErr
            }
            usedBackup = true
          }
        }

        // Backup: Groq (also handles voice)
        if (!hasClaude || usedBackup) {
          if (!hasGroq) throw new Error('Claude failed and Groq not configured')
          console.log('[Fallback] Using Groq backup')
          responseText = await runGroqChat({
            systemPrompt,
            messages: modelMessages,
            mcp,
            onStatus: (name, args) => {
              emit({ type: 'status', ...statusLabel(name, args) })
            },
            onOrderPreview,
          })
        }

        emit({
          type: 'status',
          icon: 'sparkles',
          key: 'assemble',
          label: 'Putting it together',
        })

        let payload: ChatPayload = buildPayload(sanitizeAssistantText(responseText))

        if (
          payload.type === 'product_trio' &&
          lastUserMessage &&
          isNonShoppingTurn(lastUserMessage.content, messages)
        ) {
          const answer =
            payload.rawText?.trim() ||
            payload.trio?.context?.trim() ||
            'Tell me a bit more — happy to help.'
          payload = { type: 'chat', text: answer, chips: payload.chips }
        }

        if (pendingOrderArgs && cart.length > 0) {
          const details = orderArgsToCheckoutDetails(
            pendingOrderArgs,
            checkoutDetails ?? undefined
          )
          const preview = await getCheckoutPreview(cart, details)
          payload = buildOrderPreviewPayload(
            cart,
            details,
            preview,
            stripBlocks(sanitizeAssistantText(responseText)) ||
              'Please review your order below — tap Confirm when ready.'
          )
        }
        emit({ type: 'final', payload })
      } catch (e) {
        console.error('chat route error:', e)
        emit({
          type: 'final',
          payload: {
            type: 'chat',
            text: 'Something went wrong. Please try again.',
          },
        })
      } finally {
        clearInterval(heartbeatTimer)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
