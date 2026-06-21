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

/** Extract checkout URL, ref, and totals from a JSON object (Kapruka response_format=json). */
function extractFromJsonObject(obj: Record<string, unknown>): PartialOrder {
  const summary =
    obj.summary && typeof obj.summary === 'object'
      ? (obj.summary as Record<string, unknown>)
      : null

  const url = String(
    obj.checkout_url ?? obj.pay_url ?? obj.payment_url ?? obj.checkoutUrl ?? ''
  ).trim()
  const ref = String(
    obj.order_ref ?? obj.order_id ?? obj.order_number ?? obj.orderRef ?? ''
  ).trim()
  const expiresAt = obj.expires_at ?? obj.expiresAt

  let subtotal: number | undefined
  let deliveryFee: number | undefined
  let total: number | undefined

  if (summary) {
    subtotal = toAmount(summary.items_total ?? summary.itemsTotal ?? summary.subtotal)
    deliveryFee = toAmount(
      summary.delivery_fee ?? summary.deliveryFee ?? summary.delivery
    )
    total = toAmount(summary.grand_total ?? summary.grandTotal ?? summary.total)
  } else {
    subtotal = toAmount(obj.items_total ?? obj.itemsTotal ?? obj.subtotal)
    deliveryFee = toAmount(obj.delivery_fee ?? obj.deliveryFee ?? obj.delivery)
    total = toAmount(obj.grand_total ?? obj.grandTotal ?? obj.total ?? obj.total_lkr)
  }

  return {
    url: url || null,
    ref: ref || null,
    expiresAt: expiresAt ? String(expiresAt) : null,
    subtotal,
    deliveryFee,
    total,
  }
}

/** Walk JSON / MCP payloads and collect markdown text blobs. */
function collectTextBlobs(raw: string): string[] {
  const blobs = new Set<string>([raw])

  const visit = (node: unknown) => {
    if (typeof node === 'string') {
      if (
        node.includes('Grand total') ||
        node.includes('Order created') ||
        node.includes('checkout') ||
        node.includes('Delivery')
      ) {
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

/** Parse Kapruka MCP kapruka_create_order response (JSON and/or markdown). */
export function parseKaprukaOrderResponse(raw: string): OrderResult {
  const trimmed = raw.trim()
  let merged: PartialOrder = {}

  // JSON object (response_format=json)
  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>
    merged = mergeOrder(merged, extractFromJsonObject(j))

    if (typeof j.result === 'string') {
      try {
        merged = mergeOrder(merged, extractFromJsonObject(JSON.parse(j.result) as Record<string, unknown>))
      } catch {
        merged = mergeOrder(merged, parseOrderMarkdown(j.result) ?? {})
      }
    } else if (j.result && typeof j.result === 'object') {
      merged = mergeOrder(merged, extractFromJsonObject(j.result as Record<string, unknown>))
    }
  } catch {
    /* markdown path below */
  }

  // Markdown tables in any text blob
  for (const blob of collectTextBlobs(trimmed)) {
    const md = parseOrderMarkdown(blob)
    if (md) merged = mergeOrder(merged, md)
    const totals = extractTotalsFromMarkdown(blob)
    merged = mergeOrder(merged, totals)
  }

  finalizeTotals(merged)

  if (!merged.url && !merged.ref) {
    throw new Error(
      'Could not get a payment link from Kapruka. Please verify delivery details and try again.'
    )
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
    text.match(/`?(ORD-[A-Za-z0-9-]+)`?/i)?.[1]?.trim()

  const payLinkMatch =
    text.match(/\[([^\]]*(?:pay|checkout|Open)[^\]]*)\]\((https?:\/\/[^)]+)\)/i) ??
    text.match(/(https?:\/\/[^\s)\]"']*kapruka[^\s)\]"']*)/i)

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
