import type { CartItem, CheckoutDetailsInput, OrderResult } from '@/types'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'

export type CheckoutInput = CheckoutDetailsInput & { cart: CartItem[] }

export async function createKaprukaOrder(input: CheckoutInput): Promise<OrderResult> {
  const mcp = new KaprukaMCPClient()
  const output = await mcp.callTool('kapruka_create_order', {
    cart: input.cart.map((i) => ({
      product_id: i.id,
      quantity: i.quantity,
      icing_text: i.icingText,
    })),
    recipient: { name: input.recipient.name, phone: input.recipient.phone },
    delivery: {
      address: input.recipient.address,
      city: input.recipient.city,
      date: input.recipient.date,
      special_instructions: input.specialInstructions,
    },
    sender: {
      name: input.senderName,
      email: input.senderEmail || DEFAULT_SENDER_EMAIL,
      anonymous: false,
    },
    gift_message: input.giftMessage,
    currency: 'LKR',
    response_format: 'json',
  })

  try {
    const j = JSON.parse(output) as {
      checkout_url?: string
      order_ref?: string
      expires_at?: string
    }
    return {
      url: j.checkout_url ?? null,
      ref: j.order_ref ?? null,
      expiresAt: j.expires_at ?? null,
    }
  } catch (e) {
    console.error('Failed to parse order response. Raw output:', output)
    throw new Error(`Order failed: ${output}`)
  }
}
