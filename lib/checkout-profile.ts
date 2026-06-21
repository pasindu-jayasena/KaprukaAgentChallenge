import type { CartItem, CheckoutDetailsInput, SavedCheckoutProfile } from '@/types'

export const DEFAULT_SENDER_EMAIL = 'guest@kapruka.com'

export function buildCheckoutDetailsMessage(
  data: CheckoutDetailsInput,
  cart: CartItem[],
  label = 'Cart'
): string {
  const cartSummary = cart
    .map((i) => `${i.name} × ${i.quantity} = Rs. ${i.price * i.quantity}`)
    .join(', ')
  const parts = [
    `CHECKOUT_DETAILS: ${label}: [${cartSummary}]`,
    `Recipient: Name=${data.recipient.name}`,
    `Phone=${data.recipient.phone}`,
    `Address=${data.recipient.address}`,
    `City=${data.recipient.city}`,
    `Date=${data.recipient.date}`,
    `Sender=${data.senderName}`,
    `SenderEmail=${data.senderEmail}`,
  ]
  if (data.giftMessage) parts.push(`GiftMessage=${data.giftMessage}`)
  if (data.specialInstructions) parts.push(`SpecialInstructions=${data.specialInstructions}`)
  return parts.join('; ')
}

/** Internal-only — never expose other names or "database" language to the customer. */
export function buildSavedCheckoutBlock(profiles: SavedCheckoutProfile[]): string {
  if (!profiles.length) return ''

  const lines = [
    '═══ SAVED RECIPIENTS (internal only) ═══',
    'Match by first name (case-insensitive). Never mention other names to the customer.',
    '',
  ]

  profiles.forEach((profile, i) => {
    lines.push(
      `[${i + 1}] ${profile.recipient.name}`,
      `    phone: ${profile.recipient.phone}`,
      `    address: ${profile.recipient.address}, ${profile.recipient.city}`,
      `    sender: ${profile.senderName}`,
      profile.giftMessage ? `    gift_message: "${profile.giftMessage}"` : '',
      profile.specialInstructions
        ? `    delivery_instructions: "${profile.specialInstructions}"`
        : '',
      ''
    )
  })

  lines.push(
    'FLOW:',
    '1. Ask ONLY for recipient name — nothing about checking files or databases.',
    '2. If name matches → show phone/address/city and ask "Are these details still correct?"',
    '3. If no match → ask for phone, address, city, date in one friendly message.',
    '4. Never say "on file", "saved", "database", or mention other people.',
  )

  return lines.filter(Boolean).join('\n')
}
