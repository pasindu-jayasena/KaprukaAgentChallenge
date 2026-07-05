import { buildSystemPrompt } from '@/lib/prompts/anu-system'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { runClaudeChat, isClaudeAvailable, isClaudeQuotaError } from '@/lib/server/claude-chat'
import { runGroqChat } from '@/lib/server/groq-chat'
import { chatRequestSchema } from '@/schemas/chat-request'
import { getDeviceId } from '@/lib/server/session-cookies'
import { checkRateLimit, clientKeyFromRequest } from '@/lib/server/rate-limit'
import { getProfile, updateProfile } from '@/lib/server/user-memory'
import { getCheckoutPreview } from '@/lib/checkout-preview'
import { orderArgsToCheckoutDetails } from '@/lib/order-args'
import { parseCheckoutDetails } from '@/lib/parse-checkout-details'
import { messagesForModel } from '@/lib/conversation-context'
import { sanitizeAssistantText } from '@/lib/server/mcp-order'
import { isNonShoppingTurn } from '@/lib/chat-intent'
import { polishAssistantText } from '@/lib/prompts/singlish-style'
import { getEnglishDirectReply, getSinhalaDirectReply, getSinglishDirectReply, getTanglishDirectReply } from '@/lib/singlish-dialogue'
import { runAgenticShoppingPipeline } from '@/lib/agent-orchestrator'
import { continueCheckoutCollection, inferConversationMode } from '@/lib/conversation-flow'
import {
  getTrackingDecision,
  normalizeTrackingResponse,
  trackingAskPayload,
  trackingErrorPayload,
  trackingSuccessText,
} from '@/lib/order-tracking'
import {
  checkoutDetailsAreValid,
  forcePlanToCollectDetails,
  normalizeCheckoutDetails,
} from '@/lib/checkout-validation'
import type { CartAction, CartItem, ChatPayload, CheckoutDetailsInput } from '@/types'

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
    case 'agent_concierge':
      return { icon: 'sparkles', key: 'concierge', label: String(args.label ?? 'Reading the situation') }
    case 'agent_logistics':
      return { icon: 'truck', key: 'logistics', label: String(args.label ?? 'Checking the practical side') }
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
    .replace(/<ADD_TO_CART>[\s\S]*?<\/ADD_TO_CART>/gi, '')
    .replace(/<function[\s\S]*?<\/function>/gi, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/CHECKOUT_DETAILS:[\s\S]*?(?=\n\n|$)/gi, '')
    .trim()
}

/**
 * Parse and validate the model's <ADD_TO_CART> tag. Invalid/hallucinated tags
 * are dropped here so the client never mutates the cart on bad data.
 */
function parseCartAction(text: string): CartAction | undefined {
  const block = parseBlock(text, 'ADD_TO_CART')
  if (!block.data || typeof block.data !== 'object') return undefined
  const raw = block.data as Record<string, unknown>
  const id = String(raw.id ?? raw.product_id ?? '').trim()
  const name = String(raw.name ?? '').trim()
  const price = Number(raw.price)
  const quantity = Math.min(Math.max(Math.round(Number(raw.quantity) || 1), 1), 10)
  if (!id || !name || !Number.isFinite(price) || price <= 0) return undefined
  return {
    id,
    name,
    price,
    image: typeof raw.image === 'string' ? raw.image : typeof raw.image_url === 'string' ? raw.image_url : null,
    url: typeof raw.url === 'string' ? raw.url : null,
    quantity,
  }
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
  const cartAction = parseCartAction(text)

  const trio = parseBlock(text, 'PRODUCT_TRIO')
  if (trio.data) {
    const rawText = stripBlocks(text)
    return { type: 'product_trio', trio: trio.data, rawText: rawText || undefined, chips, cartAction }
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
    cartAction,
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

  const rate = await checkRateLimit('chat', clientKeyFromRequest(req, deviceId))
  if (!rate.allowed) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 30) },
    })
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
        const conversationMode = inferConversationMode(messages, cart)

        if (lastUserMessage && !checkoutDetails) {
          const checkoutContinuation = continueCheckoutCollection(messages, cart, chatLang)
          if (checkoutContinuation?.payload) {
            emit({ type: 'final', payload: checkoutContinuation.payload })
            return
          }
          if (checkoutContinuation?.details) {
            emit({
              type: 'status',
              icon: 'search',
              key: 'delivery',
              label: 'Checking delivery fee',
            })
            try {
              const normalizedCheckout = normalizeCheckoutDetails(checkoutContinuation.details)
              const preview = await getCheckoutPreview(cart, normalizedCheckout)
              emit({
                type: 'final',
                payload: buildOrderPreviewPayload(
                  cart,
                  normalizedCheckout,
                  preview,
                  'Perfect, I have the delivery details. Please review this before I prepare the payment link.'
                ),
              })
              return
            } catch (previewErr) {
              console.error('Checkout continuation preview error:', previewErr)
              emit({
                type: 'final',
                payload: {
                  type: 'chat',
                  text: 'I have the details, but I could not load the delivery fee. Please check the city/date and try again.',
                },
              })
              return
            }
          }

          const trackingDecision = getTrackingDecision(lastUserMessage.content, { mode: conversationMode })
          if (trackingDecision.action === 'ask') {
            emit({ type: 'final', payload: trackingAskPayload(chatLang) })
            return
          }
          if (trackingDecision.action === 'track') {
            emit({ type: 'status', ...statusLabel('kapruka_track_order', { order_number: trackingDecision.orderNumber }) })
            const rawTracking = await mcp.callTool('kapruka_track_order', {
              order_number: trackingDecision.orderNumber,
              response_format: 'json',
            })
            const tracking = normalizeTrackingResponse(rawTracking, trackingDecision.orderNumber)
            if (!tracking) {
              emit({ type: 'final', payload: trackingErrorPayload(trackingDecision.orderNumber, chatLang) })
              return
            }
            emit({
              type: 'final',
              payload: {
                type: 'order_tracking',
                rawText: trackingSuccessText(tracking, chatLang),
                tracking,
                chips: ['Track another order', 'Need another gift', 'Shop for myself'],
              },
            })
            return
          }
        }

        // Structured checkout from chat — show review card first, not payment slip
        if (checkoutDetails && cart.length > 0) {
          const normalizedCheckout = normalizeCheckoutDetails(checkoutDetails)
          if (!checkoutDetailsAreValid(normalizedCheckout)) {
            emit({
              type: 'final',
              payload: {
                type: 'chat',
                text:
                  'I need the actual recipient name, phone, full address, city, delivery date, and sender name before I can prepare the order review. Please update those details and try again.',
              },
            })
            return
          }
          emit({
            type: 'status',
            icon: 'search',
            key: 'delivery',
            label: 'Checking delivery fee',
          })
          try {
            const preview = await getCheckoutPreview(cart, normalizedCheckout)
            emit({
              type: 'final',
              payload: buildOrderPreviewPayload(cart, normalizedCheckout, preview),
            })
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
            return
          }
        }

        const onOrderPreview = (args: Record<string, unknown>) => {
          pendingOrderArgs = args
        }

        const onStatus = (name: string, args: Record<string, unknown>) => {
          emit({ type: 'status', ...statusLabel(name, args) })
        }

        const explicitEnglishRequest =
          !!lastUserMessage &&
          /\b(english|ingrisi|ingreesi)\s+(walin|valin|with|in)\b/i.test(
            lastUserMessage.content
          )

        if (
          lastUserMessage &&
          !checkoutDetails
        ) {
          // ─── FAST PATH 1: Direct replies for very short social phrases ───
          // (greetings, thanks, "kohomada" etc. — instant, no LLM needed)
          const directReply =
            chatLang === 'tanglish'
              ? getTanglishDirectReply(lastUserMessage.content)
              : chatLang === 'si'
              ? getSinhalaDirectReply(lastUserMessage.content)
              : chatLang === 'singlish' || explicitEnglishRequest
              ? getSinglishDirectReply(lastUserMessage.content)
              : getEnglishDirectReply(lastUserMessage.content)
          // Never repeat the same canned line — if we already said this recently,
          // fall through to the LLM so the reply reacts to the actual message.
          const recentAssistant = messages
            .filter((m) => m.role === 'assistant')
            .slice(-6)
          const alreadySaid =
            !!directReply &&
            recentAssistant.some((m) => m.content.includes(directReply.text.trim()))
          if (directReply && !alreadySaid) {
            emit({
              type: 'final',
              payload: {
                type: 'chat',
                text: polishAssistantText(directReply.text, chatLang),
                chips: directReply.chips,
              },
            })
            return
          }

          // ─── FAST PATH 2: Exact-match shopping (e.g. "show chocolates") ───
          // For everything else, falls through to LLM
          const shortcutPayload = await runAgenticShoppingPipeline({
            text: lastUserMessage.content,
            chatLang,
            mcp,
            messages,
            emitStatus: (name, args = {}) => emit({ type: 'status', ...statusLabel(name, args) }),
          })

          if (shortcutPayload) {
            emit({ type: 'final', payload: shortcutPayload })
            return
          }
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

        const assistantText = polishAssistantText(
          sanitizeAssistantText(responseText),
          chatLang
        )
        let payload: ChatPayload = buildPayload(assistantText)

        if (payload.type === 'plan_board' && !checkoutDetailsAreValid({
          senderName: String(payload.plan.sender_name ?? ''),
          senderEmail: String(payload.plan.sender_email ?? 'guest@kapruka.com'),
          giftMessage: payload.plan.gift_message,
          specialInstructions: payload.plan.special_instructions,
          recipient: {
            name: String(payload.plan.recipient?.name ?? ''),
            phone: String(payload.plan.recipient?.phone ?? ''),
            address: String(payload.plan.recipient?.address ?? ''),
            city: String(payload.plan.delivery?.city ?? ''),
            date: String(payload.plan.delivery?.date ?? ''),
          },
        })) {
          payload = {
            type: 'plan_board',
            plan: forcePlanToCollectDetails(payload.plan),
            rawText:
              'Before I prepare the payment link, please confirm the actual recipient and sender details.',
            chips: payload.chips,
          }
        }

        if (
          payload.type === 'product_trio' &&
          lastUserMessage &&
          isNonShoppingTurn(lastUserMessage.content)
        ) {
          const answer =
            payload.rawText?.trim() ||
            payload.trio?.context?.trim() ||
            'Tell me a bit more — happy to help.'
          payload = { type: 'chat', text: answer, chips: payload.chips }
        }

        if (pendingOrderArgs && cart.length > 0) {
          const details = normalizeCheckoutDetails(orderArgsToCheckoutDetails(
            pendingOrderArgs,
            checkoutDetails ?? undefined
          ))
          if (!checkoutDetailsAreValid(details)) {
            payload = {
              type: 'chat',
              text:
                'I need the actual recipient name, phone, full address, city, delivery date, and sender name before I can prepare the order review.',
              chips: ['Enter details', 'Use saved recipient', 'Open cart'],
            }
            emit({ type: 'final', payload })
            return
          }
          const preview = await getCheckoutPreview(cart, details)
          payload = buildOrderPreviewPayload(
            cart,
            details,
            preview,
            stripBlocks(assistantText) ||
              'Please review your order below — tap Confirm when ready.'
          )
        }
        emit({ type: 'final', payload })
      } catch (e) {
        console.error('chat route error:', e)
        const fallbackByLang: Record<string, { text: string; chip: string }> = {
          si: { text: 'අයියෝ, පොඩි ප්‍රශ්නයක් වුණා. තව පාරක් try කරමුද?', chip: 'ආයෙත් try කරන්න' },
          ta: { text: 'ஐயோ, ஒரு சிறு பிரச்சனை வந்துவிட்டது. மீண்டும் முயற்சிக்கலாமா?', chip: 'மீண்டும் முயற்சி' },
          singlish: { text: 'Aiyo, poddak issue ekak una. Aye try karamu da?', chip: 'Try again' },
          tanglish: { text: 'Aiyo, oru chinna problem. Thirumba try pannalama?', chip: 'Try again' },
          en: { text: 'Oh no, I hit a snag on my end. Shall we try that again?', chip: 'Try again' },
        }
        const fallback = fallbackByLang[chatLang] ?? fallbackByLang.en
        emit({
          type: 'final',
          payload: {
            type: 'chat',
            text: fallback.text,
            chips: [fallback.chip],
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
