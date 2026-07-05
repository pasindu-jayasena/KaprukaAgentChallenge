import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createKaprukaOrder } from '@/lib/checkout'
import { KaprukaOrderParseError, resolveReceiptTotals } from '@/lib/parse-order-result'
import {
  normalizeCheckoutDetails,
  validateCheckoutDetails,
} from '@/lib/checkout-validation'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { checkRateLimit, clientKeyFromRequest } from '@/lib/server/rate-limit'

const schema = z.object({
  cart: z.array(
    z.object({
      id: z.string().catch('unknown'),
      name: z.string().catch('Unknown Item'),
      price: z.coerce.number().catch(0),
      quantity: z.coerce.number().catch(1),
      icingText: z.string().nullish(),
    })
  ),
  recipient: z.object({
    name: z.string().min(1, 'Recipient name is required'),
    phone: z.string().min(7, 'Phone number is required'),
    address: z.string().min(3, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    date: z.string().min(8, 'Delivery date is required'),
  }),
  senderName: z.string().min(1, 'Sender name is required'),
  senderEmail: z.string().email('Valid sender email is required').catch('guest@kapruka.com'),
  giftMessage: z.string().nullish(),
  specialInstructions: z.string().nullish(),
})

type CheckoutErrorBody = {
  error: string
  reason?: string
  details?: string
}

function maskSensitive(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:\+?94|0)?\d[\d\s-]{7,}\d\b/g, '[phone]')
}
// Map known Kapruka API errors to user-friendly messages
function friendlyError(errorMsg: string): string {
  if (errorMsg.includes('city_not_deliverable')) {
    const city = errorMsg.match(/City.*?:\s*(.*)/)?.[1]?.trim()
    return city
      ? `Sorry, we can't deliver to "${city}" yet. Try a nearby city like Colombo, Kandy, or Galle.`
      : "Sorry, that city isn't in our delivery network yet. Try a nearby major city."
  }
  if (errorMsg.includes('product_unavailable') || errorMsg.includes('out_of_stock')) {
    return 'One of the items in your cart is currently out of stock. Please remove it and try again.'
  }
  if (errorMsg.includes('rate_limit') || errorMsg.includes('RATE_LIMIT')) {
    return "We're handling a lot of orders right now. Please try again in about 30 seconds."
  }
  if (errorMsg.includes('invalid_date')) {
    return "That delivery date doesn't work. Please pick a date at least 1 day from now."
  }
  if (errorMsg.includes('Could not get a payment link')) {
    return 'Kapruka did not return a payment link or order reference for this checkout. Please try again, or change the item/delivery details.'
  }
  // Fallback: strip the technical prefix
  return errorMsg.replace(/^Order failed:\s*/i, '').trim() || 'Checkout failed. Please try again.'
}


function checkoutErrorBody(error: unknown): CheckoutErrorBody & { retryable?: boolean } {
  const msg = error instanceof Error ? error.message : 'Checkout failed'
  const body: CheckoutErrorBody & { retryable?: boolean } = { error: friendlyError(msg) }

  if (error instanceof KaprukaOrderParseError) {
    body.reason = error.message
    if (error.rawSnippet) body.details = maskSensitive(error.rawSnippet)
    body.retryable = (error as KaprukaOrderParseError & { retryable?: boolean }).retryable ?? false
  } else if (error instanceof Error && /rate_limit|timeout|ECONNRE|fetch failed/i.test(error.message)) {
    body.retryable = true
  }

  return body
}
// Basic HTML sanitization for string inputs
function sanitize(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim()
}

function extractMcpPrice(raw: string): number | null {
  try {
    const trimmed = raw.trim()
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first < 0 || last <= first) return null
    const data = JSON.parse(trimmed.slice(first, last + 1)) as {
      price?: number | { amount?: number }
      product?: { price?: number | { amount?: number } }
    }
    const price = data.price ?? data.product?.price
    if (typeof price === 'number') return price
    if (price && typeof price === 'object') return Number(price.amount ?? NaN)
    return null
  } catch {
    return null
  }
}

/**
 * Don't trust client-sent prices: re-fetch each item from Kapruka MCP and use
 * the catalog price. Fails open (keeps client price, logs) if a lookup fails,
 * since the final authoritative total still comes from Kapruka's order response.
 */
async function repriceCart<T extends { id: string; price: number }>(cart: T[]): Promise<T[]> {
  const mcp = new KaprukaMCPClient()
  return Promise.all(
    cart.map(async (item) => {
      try {
        const raw = await mcp.callTool('kapruka_get_product', { product_id: item.id })
        const mcpPrice = extractMcpPrice(raw)
        if (mcpPrice != null && Number.isFinite(mcpPrice) && mcpPrice > 0 && mcpPrice !== item.price) {
          console.warn(
            `[checkout] Price mismatch for ${item.id}: client sent ${item.price}, catalog says ${mcpPrice} — using catalog price`
          )
          return { ...item, price: mcpPrice }
        }
      } catch (err) {
        console.error(`[checkout] Reprice lookup failed for ${item.id}:`, err)
      }
      return item
    })
  )
}

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit('checkout', clientKeyFromRequest(req))
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "We're handling a lot of orders right now. Please wait a moment and try again.", retryable: true },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 30) } }
      )
    }
    const raw = await req.json()
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      console.error('Checkout validation error:', parsed.error)
      return NextResponse.json(
        { error: firstError?.message || 'Invalid checkout details. Please fill in all fields.' },
        { status: 400 }
      )
    }

    const body = parsed.data
    const normalizedDetails = normalizeCheckoutDetails({
      senderName: body.senderName,
      senderEmail: body.senderEmail,
      giftMessage: body.giftMessage ?? undefined,
      specialInstructions: body.specialInstructions ?? undefined,
      recipient: body.recipient,
    })
    const detailIssues = validateCheckoutDetails(normalizedDetails)
    if (detailIssues.length) {
      return NextResponse.json(
        { error: detailIssues[0] },
        { status: 400 }
      )
    }

    // Sanitize string inputs
    const sanitizedRecipient = {
      name: sanitize(normalizedDetails.recipient.name),
      phone: sanitize(normalizedDetails.recipient.phone),
      address: sanitize(normalizedDetails.recipient.address),
      city: sanitize(normalizedDetails.recipient.city),
      date: normalizedDetails.recipient.date,
    }

    // Verify prices against the Kapruka catalog before creating the order
    const verifiedCart = await repriceCart(body.cart)

    const orderResult = await createKaprukaOrder({
      cart: verifiedCart.map((i) => ({
        id: i.id,
        name: sanitize(i.name),
        price: i.price,
        image: null,
        url: null,
        quantity: i.quantity,
        icingText: i.icingText ? sanitize(i.icingText) : undefined,
      })),
      recipient: sanitizedRecipient,
      senderName: sanitize(normalizedDetails.senderName),
      senderEmail: sanitize(normalizedDetails.senderEmail),
      giftMessage: normalizedDetails.giftMessage ? sanitize(normalizedDetails.giftMessage) : undefined,
      specialInstructions: normalizedDetails.specialInstructions
        ? sanitize(normalizedDetails.specialInstructions)
        : undefined,
    })

    const cartSubtotal = verifiedCart.reduce((s, i) => s + i.price * i.quantity, 0)
    const pricing = resolveReceiptTotals({
      orderResult,
      subtotal: cartSubtotal,
      items: verifiedCart.map((i) => ({ price: i.price, quantity: i.quantity })),
    })

    return NextResponse.json({
      orderResult,
      items: verifiedCart.map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      })),
      recipient: sanitizedRecipient,
      subtotal: pricing.subtotal,
      deliveryFee: pricing.deliveryFee,
      total: pricing.total,
      senderName: normalizedDetails.senderName,
      senderEmail: normalizedDetails.senderEmail,
      giftMessage: normalizedDetails.giftMessage,
      specialInstructions: normalizedDetails.specialInstructions,
    })
  } catch (e) {
    const body = checkoutErrorBody(e)
    console.error('Checkout error:', body.reason ?? body.error, body.details ?? '')
    // Use 502 for upstream/MCP failures (retryable), 400 for validation/data issues
    const status = body.retryable ? 502 : 400
    return NextResponse.json(body, { status })
  }
}
