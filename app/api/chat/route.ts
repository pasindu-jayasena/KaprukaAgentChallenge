import { buildSystemPrompt } from '@/lib/prompts/anu-system'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { rateLimited } from '@/lib/server/rate-limit'
import { runClaudeChat, isClaudeAvailable, isClaudeQuotaError } from '@/lib/server/claude-chat'
import { runGroqChat } from '@/lib/server/groq-chat'
import { chatRequestSchema } from '@/schemas/chat-request'
import { getDeviceId } from '@/lib/server/session-cookies'
import { getProfile, updateProfile, extractInterests } from '@/lib/server/user-memory'
import { createKaprukaOrder } from '@/lib/checkout'
import { parseCheckoutDetails } from '@/lib/parse-checkout-details'
import type { CartItem, OrderResult, ChatPayload, CheckoutDetailsInput, SavedCheckoutProfile } from '@/types'

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
  if (trio.data) return { type: 'product_trio', trio: trio.data, chips }

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

/** Extract plan board data from the LLM response text for the checkout receipt */
function extractPlanBoardContext(responseText: string): {
  items?: Array<{ id?: string; name: string; price: number; quantity: number; image?: string | null }>
  recipient?: { name: string; phone: string; city: string; address: string; date: string }
  subtotal?: number
  deliveryFee?: number
  total?: number
  giftMessage?: string
  senderName?: string
  senderEmail?: string
  specialInstructions?: string
} | null {
  const plan = parseBlock(responseText, 'PLAN_BOARD')
  if (!plan.data) return null

  const d = plan.data as Record<string, unknown>
  const items = Array.isArray(d.items)
    ? d.items.map((i: Record<string, unknown>) => ({
        name: String(i.name || ''),
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        image: (i.image_url as string) || null,
      }))
    : undefined

  const delivery = d.delivery as Record<string, unknown> | undefined
  const recipient = d.recipient as Record<string, unknown> | undefined
  const recipientData = recipient && delivery
    ? {
        name: String(recipient.name || ''),
        phone: String(recipient.phone || ''),
        city: String(delivery.city || ''),
        address: String(recipient.address || delivery.address || ''),
        date: String(delivery.date || ''),
      }
    : undefined

  return {
    items,
    recipient: recipientData,
    subtotal: Number(d.subtotal) || undefined,
    deliveryFee: Number(d.delivery_fee) || undefined,
    total: Number(d.total) || undefined,
    giftMessage: d.gift_message ? String(d.gift_message) : undefined,
    senderName: d.sender_name ? String(d.sender_name) : undefined,
    senderEmail: d.sender_email ? String(d.sender_email) : undefined,
    specialInstructions: d.special_instructions ? String(d.special_instructions) : undefined,
  }
}

function buildCheckoutPayload(
  orderResult: OrderResult,
  cart: CartItem[],
  responseText: string,
  checkoutDetails?: CheckoutDetailsInput
): ChatPayload {
  const planContext = extractPlanBoardContext(responseText)
  const subtotal =
    planContext?.subtotal ?? cart.reduce((s, i) => s + i.price * i.quantity, 0)

  return {
    type: 'checkout',
    orderResult,
    text: stripBlocks(responseText) || 'Your order is locked in! Tap the payment link below to complete it on Kapruka.com 🎉',
    items:
      planContext?.items ??
      cart.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
        url: i.url,
      })),
    cartRestore: cart.map((i) => ({ ...i })),
    recipient: checkoutDetails?.recipient ?? planContext?.recipient,
    subtotal,
    deliveryFee: planContext?.deliveryFee,
    total: planContext?.total ?? subtotal,
    giftMessage: checkoutDetails?.giftMessage ?? planContext?.giftMessage,
    senderName: checkoutDetails?.senderName ?? planContext?.senderName,
    senderEmail: checkoutDetails?.senderEmail ?? planContext?.senderEmail,
    specialInstructions:
      checkoutDetails?.specialInstructions ?? planContext?.specialInstructions,
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

  // Rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({
        type: 'final',
        payload: {
          type: 'chat',
          text: "You're moving fast! Give me a minute, then try again.",
        },
      }) + '\n',
      { status: 429, headers: { 'Content-Type': 'application/x-ndjson' } }
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
          })) ?? null
        )
        let orderResult: OrderResult | null = null
        let responseText = ''

        // Structured checkout from chat form — same path as manual cart checkout
        if (checkoutDetails && cart.length > 0) {
          emit({
            type: 'status',
            icon: 'lock',
            key: 'order',
            label: 'Locking in your order',
          })
          try {
            orderResult = await createKaprukaOrder({
              cart,
              recipient: checkoutDetails.recipient,
              senderName: checkoutDetails.senderName,
              senderEmail: checkoutDetails.senderEmail,
              giftMessage: checkoutDetails.giftMessage,
              specialInstructions: checkoutDetails.specialInstructions,
            })
            responseText =
              'Your order is locked in! Tap the payment link below to complete it on Kapruka.com 🎉'
          } catch (orderErr) {
            const msg =
              orderErr instanceof Error ? orderErr.message : 'Checkout failed'
            emit({
              type: 'final',
              payload: {
                type: 'chat',
                text: msg.replace(/^Order failed:\s*/i, '').trim() || 'Checkout failed. Please check your details and try again.',
              },
            })
            clearInterval(heartbeatTimer)
            controller.close()
            return
          }
        }

        const onStatus = (name: string, args: Record<string, unknown>) => {
          emit({ type: 'status', ...statusLabel(name, args) })
        }

        const onOrderResult = (r: OrderResult) => {
          orderResult = r
        }

        // Primary: Claude via tokenlb.net (skip if order already created from form)
        let usedBackup = false
        if (!orderResult && hasClaude) {
          try {
            responseText = await runClaudeChat({
              systemPrompt,
              messages: messages.map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
              mcp,
              onStatus,
              onOrderResult,
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
        if (!orderResult && (!hasClaude || usedBackup)) {
          if (!hasGroq) throw new Error('Claude failed and Groq not configured')
          console.log('[Fallback] Using Groq backup')
          responseText = await runGroqChat({
            systemPrompt,
            messages: messages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            mcp,
            onStatus: (name, args) => {
              emit({ type: 'status', ...statusLabel(name, args) })
            },
            onOrderResult: (r) => {
              orderResult = r
            },
          })
        }

        emit({
          type: 'status',
          icon: 'sparkles',
          key: 'assemble',
          label: 'Putting it together',
        })

        let payload: ChatPayload = buildPayload(responseText)

        if (orderResult) {
          try {
            const orderedNames = cart.map((i) => i.name)
            const recipientName =
              checkoutDetails?.recipient.name ?? extractPlanBoardContext(responseText)?.recipient?.name
            const city =
              checkoutDetails?.recipient.city ?? extractPlanBoardContext(responseText)?.recipient?.city

            updateProfile(deviceId, {
              orderCount: userProfile.orderCount + 1,
              recentItems: orderedNames,
              interests: extractInterests(orderedNames),
              ...(recipientName ? { recipientNames: [recipientName] } : {}),
              ...(city ? { preferredCity: city } : {}),
            })
          } catch {
            // Profile update failure is non-critical
          }

          payload = buildCheckoutPayload(
            orderResult,
            cart,
            responseText,
            checkoutDetails ?? undefined
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
