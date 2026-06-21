import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCheckoutPreview } from '@/lib/checkout-preview'

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
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid checkout details.' }, { status: 400 })
    }

    const body = parsed.data
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
      {
        senderName: body.senderName,
        senderEmail: body.senderEmail,
        giftMessage: body.giftMessage ?? undefined,
        specialInstructions: body.specialInstructions ?? undefined,
        recipient: body.recipient,
      }
    )

    return NextResponse.json({
      ...preview,
      recipient: body.recipient,
      senderName: body.senderName,
      senderEmail: body.senderEmail,
      giftMessage: body.giftMessage,
      specialInstructions: body.specialInstructions,
    })
  } catch (e) {
    console.error('Checkout preview error:', e)
    return NextResponse.json({ error: 'Could not preview order. Please try again.' }, { status: 500 })
  }
}
