import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createKaprukaOrder } from '@/lib/checkout'
import { resolveReceiptTotals } from '@/lib/parse-order-result'
import {
  normalizeCheckoutDetails,
  validateCheckoutDetails,
} from '@/lib/checkout-validation'

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
  // Fallback: strip the technical prefix
  return errorMsg.replace(/^Order failed:\s*/i, '').trim() || 'Checkout failed. Please try again.'
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

export async function POST(req: Request) {
  try {
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

    const orderResult = await createKaprukaOrder({
      cart: body.cart.map((i) => ({
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

    const cartSubtotal = body.cart.reduce((s, i) => s + i.price * i.quantity, 0)
    const pricing = resolveReceiptTotals({
      orderResult,
      subtotal: cartSubtotal,
      items: body.cart.map((i) => ({ price: i.price, quantity: i.quantity })),
    })

    return NextResponse.json({
      orderResult,
      items: body.cart.map((i) => ({
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
    const msg = e instanceof Error ? e.message : 'Checkout failed'
    console.error('Checkout error:', msg)
    return NextResponse.json(
      { error: friendlyError(msg) },
      { status: 400 }
    )
  }
}
