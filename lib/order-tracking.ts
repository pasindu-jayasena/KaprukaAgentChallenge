import type { ChatLang, ChatPayload, OrderTracking } from '@/types'

export const DEMO_TRACKING_REF = process.env.NEXT_PUBLIC_DEMO_TRACKING_REF || 'VPAY827982BA'

type TrackingDecision =
  | { action: 'ignore' }
  | { action: 'ask' }
  | { action: 'track'; orderNumber: string }

interface RawTrackingResponse {
  order_number?: string
  pnref?: string
  status?: string
  status_display?: string
  order_date?: string
  delivery_date?: string
  shipped_date?: string
  amount?: { value?: string | number; currency?: string }
  payment_method?: string
  comments?: string
  recipient?: { name?: string; phone?: string; address?: string; city?: string }
  greeting_message?: string
  special_instructions?: string
  progress?: Array<{ step?: string; timestamp?: string }>
  live_tracking_available?: boolean
  has_delivery_video?: boolean
  has_delivery_photo?: boolean
  items?: unknown[]
  error?: string
}

function clean(text: string) {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasSinhala(text: string) {
  return Array.from(text).some((ch) => {
    const code = ch.charCodeAt(0)
    return code >= 0x0d80 && code <= 0x0dff
  })
}

function hasTamil(text: string) {
  return Array.from(text).some((ch) => {
    const code = ch.charCodeAt(0)
    return code >= 0x0b80 && code <= 0x0bff
  })
}

export function extractTrackingOrderNumber(input: string): string | null {
  const demo = new RegExp('\\b' + DEMO_TRACKING_REF + '\\b', 'i')
  if (demo.test(input)) return DEMO_TRACKING_REF
  const candidates = input.toUpperCase().match(/\b[A-Z]{2,8}\d[A-Z0-9]{5,}\b|\b\d{6,}\b/g) ?? []
  return candidates[0] ?? null
}

export function getTrackingDecision(input: string): TrackingDecision {
  const text = input.trim()
  if (!text) return { action: 'ignore' }

  if (/\btry\s+demo\s+order\b/i.test(text)) return { action: 'track', orderNumber: DEMO_TRACKING_REF }

  const orderNumber = extractTrackingOrderNumber(text)
  if (orderNumber) return { action: 'track', orderNumber }

  const t = clean(text)
  const sinhalaTrackingIntent =
    hasSinhala(text) &&
    (/\u0d87\u0dab\u0dc0\u0dd4\u0db8/.test(text) || /order|track|status/i.test(text))
  const tamilTrackingIntent =
    hasTamil(text) &&
    (/\u0b86\u0bb0\u0bcd\u0b9f\u0bb0\u0bcd/.test(text) || /\u0b95\u0ba3\u0bcd\u0b95\u0bbe\u0ba3/.test(text) || /order|track|status/i.test(text))
  const trackingIntent =
    /\b(track|tracking|where is my order|where's my order|order status|status of my order|my order|delivery status)\b/.test(t) ||
    /\border\b.*\b(koheda|kohomada|track|status|eka)\b/.test(t) ||
    /\b(koheda|kohomada)\b.*\border\b/.test(t) ||
    /\b(order eka|track karanna|track karamu|mage order)\b/.test(t) ||
    sinhalaTrackingIntent ||
    tamilTrackingIntent

  return trackingIntent ? { action: 'ask' } : { action: 'ignore' }
}

export function trackingAskPayload(chatLang: ChatLang): ChatPayload {
  if (chatLang === 'singlish' || chatLang === 'si') {
    return {
      type: 'chat',
      text: 'Order eka track karanna order number eka denna. Demo balanna one nam Try demo order tap karanna.',
      chips: ['Try demo order', DEMO_TRACKING_REF, 'Shop again'],
    }
  }
  if (chatLang === 'tanglish' || chatLang === 'ta') {
    return {
      type: 'chat',
      text: 'Order track panna order number kudunga. Demo paakanumna Try demo order tap pannunga.',
      chips: ['Try demo order', DEMO_TRACKING_REF, 'Shop again'],
    }
  }
  return {
    type: 'chat',
    text: 'Sure. Send me the order number and I will check it. For the demo, tap Try demo order.',
    chips: ['Try demo order', DEMO_TRACKING_REF, 'Shop again'],
  }
}

function extractJsonObject(raw: string): RawTrackingResponse | null {
  const text = raw.trim().replace(/^\x60\x60\x60json\s*/i, '').replace(/\s*\x60\x60\x60$/i, '')
  try {
    return JSON.parse(text) as RawTrackingResponse
  } catch {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first < 0 || last <= first) return null
    try {
      return JSON.parse(text.slice(first, last + 1)) as RawTrackingResponse
    } catch {
      return null
    }
  }
}

function cleanPhone(phone?: string) {
  return String(phone ?? '').replace(/<br\s*\/?/gi, '').replace(/[<>]/g, '').trim()
}

function titleCaseStatus(status?: string) {
  const value = String(status ?? '').trim()
  if (!value) return 'Status unavailable'
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

export function normalizeTrackingResponse(raw: string, fallbackRef: string): OrderTracking | null {
  if (/rate_limit|not found|invalid|error/i.test(raw) && !raw.includes('{')) return null
  const parsed = extractJsonObject(raw)
  if (!parsed || parsed.error) return null

  const progress = (parsed.progress ?? [])
    .filter((p) => p.step || p.timestamp)
    .map((p) => ({
      step: String(p.step ?? 'Update'),
      timestamp: p.timestamp ? String(p.timestamp) : undefined,
      done: true,
    }))

  const latestUpdate = progress.length ? progress[progress.length - 1] : undefined
  const status = String(parsed.status ?? parsed.status_display ?? 'unknown')
  const statusDisplay = String(parsed.status_display ?? titleCaseStatus(status))
  const orderNumber = String(parsed.order_number ?? fallbackRef)

  return {
    ref: orderNumber,
    orderNumber,
    pnref: parsed.pnref ? String(parsed.pnref) : undefined,
    status,
    statusDisplay,
    eta: status.toLowerCase() === 'delivered' ? undefined : parsed.delivery_date ? String(parsed.delivery_date) : undefined,
    orderDate: parsed.order_date ? String(parsed.order_date) : undefined,
    deliveryDate: parsed.delivery_date ? String(parsed.delivery_date) : undefined,
    shippedDate: parsed.shipped_date ? String(parsed.shipped_date) : undefined,
    amount: parsed.amount
      ? { value: String(parsed.amount.value ?? ''), currency: String(parsed.amount.currency ?? 'LKR') }
      : undefined,
    paymentMethod: parsed.payment_method ? String(parsed.payment_method) : undefined,
    comments: parsed.comments ? String(parsed.comments) : undefined,
    recipient: parsed.recipient
      ? {
          name: String(parsed.recipient.name ?? ''),
          phone: cleanPhone(parsed.recipient.phone),
          address: String(parsed.recipient.address ?? ''),
          city: String(parsed.recipient.city ?? ''),
        }
      : undefined,
    greetingMessage: parsed.greeting_message ? String(parsed.greeting_message) : undefined,
    specialInstructions: parsed.special_instructions ? String(parsed.special_instructions) : undefined,
    progress,
    steps: progress.map((p) => ({ label: p.step, done: p.done ?? true })),
    latestUpdate,
    liveTrackingAvailable: Boolean(parsed.live_tracking_available),
    hasDeliveryVideo: Boolean(parsed.has_delivery_video),
    hasDeliveryPhoto: Boolean(parsed.has_delivery_photo),
    items: Array.isArray(parsed.items) ? parsed.items : undefined,
  }
}

export function trackingSuccessText(tracking: OrderTracking, chatLang: ChatLang) {
  const delivered = tracking.status.toLowerCase() === 'delivered'
  const city = tracking.recipient?.city ? ' to ' + tracking.recipient.city : ''
  const when = tracking.latestUpdate?.timestamp || tracking.deliveryDate || tracking.shippedDate || ''

  if (chatLang === 'singlish' || chatLang === 'si') {
    if (delivered) return 'I found it. Me order eka delivered' + (when ? ' - ' + when : '') + city + '. Kapruka side eken delivery complete karala.'
    return 'I found it. Current status eka ' + (tracking.statusDisplay ?? tracking.status) + city + '. Latest update eka card eke timeline eke thiyenawa.'
  }
  if (chatLang === 'tanglish' || chatLang === 'ta') {
    if (delivered) return 'I found it. Indha order delivered' + (when ? ' - ' + when : '') + city + '. Delivery complete aayiduchu.'
    return 'I found it. Current status ' + (tracking.statusDisplay ?? tracking.status) + city + '. Timeline-la latest update irukku.'
  }
  if (delivered) return 'I found it. This order is already delivered' + (when ? ' - ' + when : '') + city + '. Delivery is complete.'
  return 'I found it. Current status is ' + (tracking.statusDisplay ?? tracking.status) + city + '. I added the latest timeline below.'
}

export function trackingErrorPayload(orderNumber: string, chatLang: ChatLang): ChatPayload {
  const text =
    chatLang === 'singlish' || chatLang === 'si'
      ? 'Mata ' + orderNumber + ' track karanna bari una. Order number eka ayeth check karala ewannako.'
      : chatLang === 'tanglish' || chatLang === 'ta'
      ? orderNumber + ' track panna mudiyala. Order number sariyaa irukka check panni anuppunga.'
      : 'I could not find tracking for ' + orderNumber + '. Please check the order number and send it again.'
  return { type: 'chat', text, chips: ['Try demo order', 'Track another order', 'Shop again'] }
}
