import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutPreview } from '@/lib/checkout-preview'
import {
  normalizeCheckoutDetails,
  validateCheckoutDetails,
} from '@/lib/checkout-validation'
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
    name: z.string().min(1),
    phone: z.string().min(7),
    address: z.string().min(3),
    city: z.string().min(2),
    date: z.string().min(8),
  }),
  senderName: z.string().min(1),
  senderEmail: z.string().email().catch('guest@kapruka.com'),
  giftMessage: z.string().nullish(),
  specialInstructions: z.string().nullish(),
})

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit('checkout', clientKeyFromRequest(req))
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 30) } }
      )
    }

    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid checkout details.' }, { status: 400 })
    }

    const body = parsed.data
    const details = normalizeCheckoutDetails({
      senderName: body.senderName,
      senderEmail: body.senderEmail,
      giftMessage: body.giftMessage ?? undefined,
      specialInstructions: body.specialInstructions ?? undefined,
      recipient: body.recipient,
    })
    const detailIssues = validateCheckoutDetails(details)
    if (detailIssues.length) {
      return NextResponse.json({ error: detailIssues[0] }, { status: 400 })
    }

    const preview = await getCheckoutPreview(
      body.cart.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        image: null,
        url: null,
        quantity: i.quantity,
        icingText: i.icingText ?? undefined,
      })),
      details
    )

    return NextResponse.json({
      ...preview,
      recipient: details.recipient,
      senderName: details.senderName,
      senderEmail: details.senderEmail,
      giftMessage: details.giftMessage,
      specialInstructions: details.specialInstructions,
    })
  } catch (e) {
    console.error('Checkout preview error:', e)
    return NextResponse.json({ error: 'Could not preview order. Please try again.' }, { status: 500 })
  }
}
