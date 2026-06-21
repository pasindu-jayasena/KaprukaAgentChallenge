import type { CheckoutDetailsInput } from '@/types'
import { sanitizeCreateOrderArgs } from '@/lib/server/mcp-order'

export function orderArgsToCheckoutDetails(
  args: Record<string, unknown>,
  fallback?: Partial<CheckoutDetailsInput>
): CheckoutDetailsInput {
  const s = sanitizeCreateOrderArgs(args)
  const recipient = s.recipient as Record<string, unknown>
  const delivery = s.delivery as Record<string, unknown>
  const sender = s.sender as Record<string, unknown>

  return {
    senderName: String(sender.name ?? fallback?.senderName ?? 'Kapruka Customer'),
    senderEmail: fallback?.senderEmail ?? 'guest@kapruka.com',
    giftMessage: s.gift_message
      ? String(s.gift_message)
      : fallback?.giftMessage,
    specialInstructions: delivery.instructions
      ? String(delivery.instructions)
      : fallback?.specialInstructions,
    recipient: {
      name: String(recipient.name ?? fallback?.recipient?.name ?? ''),
      phone: String(recipient.phone ?? fallback?.recipient?.phone ?? ''),
      address: String(delivery.address ?? fallback?.recipient?.address ?? ''),
      city: String(delivery.city ?? fallback?.recipient?.city ?? ''),
      date: String(delivery.date ?? fallback?.recipient?.date ?? ''),
    },
  }
}
