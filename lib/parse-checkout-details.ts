import type { CheckoutDetailsInput } from '@/types'

export const DEFAULT_SENDER_EMAIL = 'guest@kapruka.com'

function pickField(text: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s*=\\s*([^;]+)`, 'i')
  const m = text.match(re)
  return m?.[1]?.trim()
}

function pickColonField(text: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s*:\\s*([^;]+)`, 'i')
  const m = text.match(re)
  return m?.[1]?.trim()
}

/** Parse structured checkout messages from chat or cart handoff */
export function parseCheckoutDetails(text: string): CheckoutDetailsInput | null {
  const normalized = text.trim()
  if (
    !normalized.includes('CHECKOUT_DETAILS:') &&
    !normalized.includes('Recipient details —')
  ) {
    return null
  }

  const senderName =
    pickField(normalized, 'Sender') ??
    pickColonField(normalized, 'Sender') ??
    ''

  const senderEmail =
    pickField(normalized, 'SenderEmail') ??
    pickColonField(normalized, 'SenderEmail') ??
    DEFAULT_SENDER_EMAIL

  const giftMessage =
    pickField(normalized, 'GiftMessage') ??
    pickField(normalized, 'PersonalMessage') ??
    pickColonField(normalized, 'GiftMessage') ??
    pickColonField(normalized, 'PersonalMessage')

  const specialInstructions =
    pickField(normalized, 'SpecialInstructions') ??
    pickColonField(normalized, 'SpecialInstructions')

  const name =
    pickField(normalized, 'Name') ??
    pickColonField(normalized, 'Name') ??
    ''
  const phone =
    pickField(normalized, 'Phone') ??
    pickColonField(normalized, 'Phone') ??
    ''
  const address =
    pickField(normalized, 'Address') ??
    pickColonField(normalized, 'Address') ??
    ''
  const city =
    pickField(normalized, 'City') ??
    pickColonField(normalized, 'City') ??
    ''
  const date =
    pickField(normalized, 'Date') ??
    pickColonField(normalized, 'Date') ??
    ''

  if (!senderName || !name || !phone || !address || !city || !date) {
    return null
  }

  return {
    senderName,
    senderEmail: senderEmail || DEFAULT_SENDER_EMAIL,
    giftMessage: giftMessage || undefined,
    specialInstructions: specialInstructions || undefined,
    recipient: { name, phone, address, city, date },
  }
}
