import type { OrderResult } from '@/types'

export interface ParsedOrderTotals {
  subtotal?: number
  deliveryFee?: number
  total?: number
}

type PartialOrder = Partial<ParsedOrderTotals> & {
  url?: string | null
  ref?: string | null
  expiresAt?: string | null
}

const URL_KEYS = new Set([
  'checkout_url',
  'checkouturl',
  'checkout_link',
  'checkoutlink',
  'pay_url',
  'payurl',
  'payment_url',
  'paymenturl',
  'payment_link',
  'paymentlink',
  'redirect_url',
  'redirecturl',
  'url',
  'link',
])

const REF_KEYS = new Set([
  'order_ref',
  'orderref',
  'order_id',
  'orderid',
  'order_number',
  'ordernumber',
  'reference',
  'ref',
  'pnref',
  'confirmation_number',
  'confirmationnumber',
  'booking_ref',
  'bookingref',
  'transaction_id',
  'transactionid',
  'invoice_id',
  'invoiceid',
])

const EXPIRES_KEYS = new Set(['expires_at', 'expiresat', 'expiry', 'expires'])
const ERROR_KEYS = new Set(['error', 'message', 'reason', 'detail', 'details'])
const SUBTOTAL_KEYS = new Set(['items_total', 'itemstotal', 'subtotal', 'sub_total'])
const DELIVERY_KEYS = new Set(['delivery_fee', 'deliveryfee', 'delivery_charge', 'deliverycharge', 'delivery'])
const TOTAL_KEYS = new Set(['grand_total', 'grandtotal', 'total_lkr', 'totallkr', 'total', 'amount'])

export class KaprukaOrderParseError extends Error {
  rawSnippet: string

  constructor(message: string, raw: string) {
    super(message)
    this.name = 'KaprukaOrderParseError'
    this.rawSnippet = raw.replace(/\s+/g, ' ').trim().slice(0, 700)
  }
}

function keyName(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, '')
}

function toAmount(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const cleaned = String(v).replace(/,/g, '').replace(/[^\d.]/g, '')
  const parsed = parseFloat(cleaned)
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined
}

function mergeOrder(target: PartialOrder, patch: PartialOrder): PartialOrder {
  return {
    url: patch.url ?? target.url,
    ref: patch.ref ?? target.ref,
    expiresAt: patch.expiresAt ?? target.expiresAt,
    subtotal: patch.subtotal ?? target.subtotal,
    deliveryFee: patch.deliveryFee ?? target.deliveryFee,
    total: patch.total ?? target.total,
  }
}

function walk(node: unknown, visit: (key: string | null, value: unknown) => void, key: string | null = null, depth = 0) {
  if (depth > 8) return
  visit(key, node)
  if (Array.isArray(node)) {
    node.forEach((value) => walk(value, visit, key, depth + 1))
    return
  }
  if (node && typeof node === 'object') {
    for (const [childKey, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, visit, childKey, depth + 1)
    }
  }
}

function findStringByKeys(
  obj: Record<string, unknown>,
  keys: Set<string>,
  isValid: (value: string) => boolean = Boolean
) {
  let found: string | null = null
  walk(obj, (key, value) => {
    if (found || !key || !keys.has(keyName(key))) return
    const text = String(value ?? '').trim()
    if (text && isValid(text)) found = text
  })
  return found
}

function findAmountByKeys(obj: Record<string, unknown>, keys: Set<string>) {
  let found: number | undefined
  walk(obj, (key, value) => {
    if (found != null || !key || !keys.has(keyName(key))) return
    found = toAmount(value)
  })
  return found
}

function findFailureMessage(obj: Record<string, unknown>) {
  let found: string | null = null
  walk(obj, (key, value) => {
    if (found || !key || !ERROR_KEYS.has(keyName(key))) return
    if (value && typeof value === 'object') return
    const text = String(value ?? '').trim()
    if (text && !/^false$|^true$|^null$/i.test(text)) found = text
  })
  return found
}

function looksLikePaymentUrl(value: string) {
  // Accept any HTTPS URL from the Kapruka MCP response — the API only returns
  // payment/checkout links, so strict keyword matching was causing false negatives
  // when Kapruka's gateway URL format changed.
  if (!/^https?:\/\//i.test(value)) return false
  // Still reject obviously wrong URLs (social media, images, etc.)
  if (/\.(jpg|jpeg|png|gif|svg|css|js)(\?|$)/i.test(value)) return false
  if (/\b(facebook|twitter|instagram|youtube|whatsapp)\b/i.test(value)) return false
  return true
}

function looksLikeRef(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{3,}$/.test(value) && !/^https?:\/\//i.test(value)
}

/** Extract checkout URL, ref, and totals from a JSON object (Kapruka response_format=json). */
function extractFromJsonObject(obj: Record<string, unknown>): PartialOrder {
  const url = findStringByKeys(obj, URL_KEYS, looksLikePaymentUrl)
  const ref = findStringByKeys(obj, REF_KEYS, looksLikeRef)
  const expiresAt = findStringByKeys(obj, EXPIRES_KEYS)

  return {
    url: url || null,
    ref: ref || null,
    expiresAt: expiresAt || null,
    subtotal: findAmountByKeys(obj, SUBTOTAL_KEYS),
    deliveryFee: findAmountByKeys(obj, DELIVERY_KEYS),
    total: findAmountByKeys(obj, TOTAL_KEYS),
  }
}

/** Walk JSON / MCP payloads and collect markdown text blobs. */
function collectTextBlobs(raw: string): string[] {
  const blobs = new Set<string>([raw])

  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      if (/grand total|order created|checkout|payment|pay|delivery|total|order/i.test(node)) {
        blobs.add(node)
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (typeof o.text === 'string') blobs.add(o.text)
      if (typeof o.result === 'string') blobs.add(o.result)
      Object.values(o).forEach(visit)
    }
  }

  try {
    visit(JSON.parse(raw))
  } catch {
    /* not JSON */
  }

  return [...blobs]
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first < 0 || last <= first) return null
    try {
      return JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function extractFailureFromRaw(raw: string) {
  const json = extractJsonObject(raw)
  if (json) {
    const message = findFailureMessage(json)
    if (message) return message
  }

  const textMatch =
    raw.match(/(?:Error|Failed|Reason|Message)\s*[:=-]\s*([^\n]{8,220})/i)?.[1]?.trim() ??
    raw.match(/RATE_LIMIT[^\n]*/i)?.[0]?.trim()
  return textMatch || null
}

/** Parse Kapruka MCP kapruka_create_order response (JSON and/or markdown). */
export function parseKaprukaOrderResponse(raw: string): OrderResult {
  const trimmed = raw.trim()
  let merged: PartialOrder = {}

  const topLevel = extractJsonObject(trimmed)
  if (topLevel) {
    merged = mergeOrder(merged, extractFromJsonObject(topLevel))

    const result = topLevel.result
    if (typeof result === 'string') {
      const nested = extractJsonObject(result)
      merged = mergeOrder(merged, nested ? extractFromJsonObject(nested) : parseOrderMarkdown(result) ?? {})
    } else if (result && typeof result === 'object') {
      merged = mergeOrder(merged, extractFromJsonObject(result as Record<string, unknown>))
    }
  }

  // Markdown tables in any text blob
  for (const blob of collectTextBlobs(trimmed)) {
    const nested = extractJsonObject(blob)
    if (nested) {
      merged = mergeOrder(merged, extractFromJsonObject(nested))
    }
    const md = parseOrderMarkdown(blob)
    if (md) merged = mergeOrder(merged, md)
    const totals = extractTotalsFromMarkdown(blob)
    merged = mergeOrder(merged, totals)
  }

  finalizeTotals(merged)

  if (!merged.url && !merged.ref) {
    console.error('[Kapruka order parse] No URL or ref found in raw response:', trimmed.slice(0, 500))
    const failure = extractFailureFromRaw(trimmed)
    const message = failure
      ? 'Order failed: ' + failure
      : 'Could not get a payment link from Kapruka. Please verify delivery details and try again.'
    const err = new KaprukaOrderParseError(message, trimmed)
    // Tag transient errors so callers can retry
    ;(err as KaprukaOrderParseError & { retryable?: boolean }).retryable =
      !failure || /rate_limit|timeout|internal|unavailable|connection/i.test(failure)
    throw err
  }

  return {
    url: merged.url ?? null,
    ref: merged.ref ?? null,
    expiresAt: merged.expiresAt ?? null,
    subtotal: merged.subtotal,
    deliveryFee: merged.deliveryFee,
    total: merged.total,
  }
}

function finalizeTotals(order: PartialOrder): void {
  if (order.subtotal != null && order.total != null && order.deliveryFee == null) {
    order.deliveryFee = Math.max(0, order.total - order.subtotal)
  }
  if (order.subtotal != null && order.deliveryFee != null && order.total == null) {
    order.total = order.subtotal + order.deliveryFee
  }
}

function parseOrderMarkdown(text: string): PartialOrder | null {
  const ref =
    text.match(/Order created\s*[—–-]\s*`([^`]+)`/i)?.[1]?.trim() ??
    text.match(/\*\*Order(?:\s+Number|\s+ID)?\*\*:\s*`?([^`\n]+)`?/i)?.[1]?.trim() ??
    text.match(/(?:Order|Reference|Ref|PN Ref)\s*[:#-]\s*`?([A-Za-z0-9_-]{4,})`?/i)?.[1]?.trim() ??
    text.match(/`?(ORD-[A-Za-z0-9-]+)`?/i)?.[1]?.trim()

  const payLinkMatch =
    text.match(/\[([^\]]*(?:pay|checkout|payment|open)[^\]]*)\]\((https?:\/\/[^)]+)\)/i) ??
    text.match(/(?:payment|pay|checkout)\s*(?:link|url)?\s*[:=-]\s*(https?:\/\/\S+)/i) ??
    text.match(/(https?:\/\/[^\s)\]"']*(?:kapruka|pay|checkout|payment)[^\s)\]"']*)/i)

  const url = (payLinkMatch?.[2] ?? payLinkMatch?.[1])?.replace(/[)\],.]+$/, '').trim()
  const expiresMatch = text.match(/expires at\s+([^\n_.]+)/i)

  if (!ref && !url) return null

  const totals = extractTotalsFromMarkdown(text)

  return {
    url: url || null,
    ref: ref || null,
    expiresAt: expiresMatch?.[1]?.trim() ?? null,
    ...totals,
  }
}

function extractTotalsFromMarkdown(text: string): ParsedOrderTotals {
  const currency = `(?:LKR|Rs\\.?|RS\\.?)`

  const grandTotal =
    matchAmount(text, new RegExp(`\\*\\*Grand total:?\\*\\*\\s*${currency}\\s*([\\d,]+)`, 'i')) ??
    matchAmount(text, new RegExp(`Grand total[:\\s]+${currency}\\s*([\\d,]+)`, 'i')) ??
    matchAmount(text, new RegExp(`\\*\\*Total\\*\\*:\\s*${currency}\\s*([\\d,]+)`, 'i'))

  const itemsSubtotal =
    matchAmount(text, new RegExp(`\\|\\s*Items\\s*\\|\\s*${currency}\\s*([\\d,]+)`, 'i')) ??
    matchAmount(text, new RegExp(`Items[:\\s]+${currency}\\s*([\\d,]+)`, 'i'))

  const deliveryFee =
    matchAmount(text, new RegExp(`\\|\\s*Delivery\\s*\\|\\s*${currency}\\s*([\\d,]+)`, 'i')) ??
    matchAmount(text, new RegExp(`Delivery[:\\s]+${currency}\\s*([\\d,]+)`, 'i'))

  const subtotal = itemsSubtotal
  let total = grandTotal
  let delivery = deliveryFee

  if (subtotal != null && total != null && delivery == null) {
    delivery = Math.max(0, total - subtotal)
  }
  if (subtotal != null && delivery != null && total == null) {
    total = subtotal + delivery
  }

  return {
    subtotal: subtotal ?? undefined,
    deliveryFee: delivery ?? undefined,
    total: total ?? undefined,
  }
}

function matchAmount(text: string, re: RegExp): number | null {
  const m = text.match(re)
  if (!m?.[1]) return null
  const n = parseInt(m[1].replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/** Merge order result totals with receipt props (prefer Kapruka API values). */
export function resolveReceiptTotals(opts: {
  orderResult: OrderResult
  subtotal?: number
  deliveryFee?: number
  total?: number
  items?: Array<{ price: number; quantity: number }>
}): { subtotal: number; deliveryFee: number; total: number } {
  const itemsSubtotal =
    opts.items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0

  const subtotal =
    opts.orderResult.subtotal ?? opts.subtotal ?? (itemsSubtotal || 0)

  const total =
    opts.orderResult.total ??
    opts.total ??
    (opts.orderResult.deliveryFee != null || opts.deliveryFee != null
      ? subtotal + (opts.orderResult.deliveryFee ?? opts.deliveryFee ?? 0)
      : subtotal)

  const deliveryFee =
    opts.orderResult.deliveryFee ??
    opts.deliveryFee ??
    Math.max(0, total - subtotal)

  return { subtotal, deliveryFee, total }
}
