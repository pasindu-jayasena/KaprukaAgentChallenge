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

export function buildSavedCheckoutBlock(profiles: SavedCheckoutProfile[]): string {
  if (!profiles.length) return ''

  const lines = ['═══ SAVED RECIPIENTS (from previous orders) ═══']

  profiles.forEach((profile, i) => {
    lines.push(
      `${i + 1}. Recipient: ${profile.recipient.name} · ${profile.recipient.phone}`,
      `   Address: ${profile.recipient.address}, ${profile.recipient.city}`,
      `   Sender: ${profile.senderName} · ${profile.senderEmail}`,
      profile.giftMessage ? `   Personal message: "${profile.giftMessage}"` : '   Personal message: none',
      profile.specialInstructions
        ? `   Special instructions: "${profile.specialInstructions}"`
        : '   Special instructions: none',
      ''
    )
  })

  lines.push(
    'CHECKOUT CONVERSATION FLOW (follow exactly):',
    'Step 1 — Ask ONLY for the recipient name first: "Who are you sending this to?" Do not ask for address or sender yet.',
    'Step 2 — If the name matches a saved recipient above, show their saved details briefly and ask: "I have these details for [name] — still correct?" Use chips: ["Yes, correct","No, update details"].',
    'Step 3 — If they confirm, use ALL saved fields for that recipient (sender name, sender email, phone, address, city, gift message, special instructions). Only ask for a new delivery date if the saved one has passed.',
    'Step 4 — If the name is new OR they want to update, collect missing fields one at a time: sender name, sender email, phone, address, city, delivery date, optional gift message.',
    'Step 5 — When complete, output <PLAN_BOARD> or proceed to order. Never skip sender name or sender email.',
    'Save mentally: each recipient name maps to their own full profile including sender details.'
  )

  return lines.join('\n')
}
