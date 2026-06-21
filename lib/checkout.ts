import type { CartItem, OrderResult, Recipient } from '@/types'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'

export interface CheckoutInput {
  cart: CartItem[]
  recipient: Recipient
  senderName: string
  giftMessage?: string
}

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
    },
    sender: { name: input.senderName, anonymous: false },
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

export function recipientToChatMessage(r: Recipient, senderName: string): string {
  return `Recipient details — Name: ${r.name}; Phone: ${r.phone}; Address: ${r.address}; City: ${r.city}; Date: ${r.date}; Sender: ${senderName}`
}
