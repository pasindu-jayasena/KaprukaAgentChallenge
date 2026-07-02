import type { CartItem, CheckoutDetailsInput, OrderResult } from '@/types'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'
import { sanitizeCreateOrderArgs } from '@/lib/server/mcp-order'
import { parseKaprukaOrderResponse } from '@/lib/parse-order-result'

export type CheckoutInput = CheckoutDetailsInput & { cart: CartItem[] }

export async function createKaprukaOrder(input: CheckoutInput): Promise<OrderResult> {
  const mcp = new KaprukaMCPClient()

  const payload = sanitizeCreateOrderArgs({
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
      instructions: input.specialInstructions,
    },
    sender: { name: input.senderName, email: input.senderEmail, anonymous: false },
    gift_message: input.giftMessage,
    currency: 'LKR',
  })

  const output = await mcp.callTool('kapruka_create_order', payload)
  return parseKaprukaOrderResponse(output)
}
