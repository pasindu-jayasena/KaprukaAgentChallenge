import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'
import type { CheckoutDetailsInput, PlanBoard } from '@/types'

const RELATIONSHIP_PLACEHOLDERS = new Set([
  'gf',
  'bf',
  'g f',
  'b f',
  'girlfriend',
  'boyfriend',
  'wife',
  'husband',
  'friend',
  'mother',
  'father',
  'amma',
  'thaththa',
  'kella',
  'kollek',
  'recipient',
  'customer',
  'na',
  'n/a',
])

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function cleanOptional(value: unknown): string | undefined {
  const v = clean(value)
  if (!v || /^(na|n\/a|none|null|not specified)$/i.test(v)) return undefined
  return v
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9/ ]/gi, '').replace(/\s+/g, ' ').trim()
}

export function isLikelyRecipientPlaceholder(name: string): boolean {
  const n = compactName(name)
  if (!n) return true
  if (RELATIONSHIP_PLACEHOLDERS.has(n)) return true
  if (n.length < 3) return true
  return false
}

export function normalizeCheckoutDetails(details: CheckoutDetailsInput): CheckoutDetailsInput {
  return {
    senderName: clean(details.senderName),
    senderEmail: clean(details.senderEmail) || DEFAULT_SENDER_EMAIL,
    giftMessage: cleanOptional(details.giftMessage),
    specialInstructions: cleanOptional(details.specialInstructions),
    recipient: {
      name: clean(details.recipient.name),
      phone: clean(details.recipient.phone),
      address: clean(details.recipient.address),
      city: clean(details.recipient.city),
      date: clean(details.recipient.date),
    },
  }
}

export function validateCheckoutDetails(details: CheckoutDetailsInput): string[] {
  const d = normalizeCheckoutDetails(details)
  const issues: string[] = []
  const phoneDigits = d.recipient.phone.replace(/\D/g, '')

  if (!d.senderName || d.senderName.length < 2) {
    issues.push('Sender name is required.')
  }
  if (!d.recipient.name || isLikelyRecipientPlaceholder(d.recipient.name)) {
    issues.push('Recipient actual name is required, not a relationship like GF/wife/friend.')
  }
  if (compactName(d.senderName) && compactName(d.senderName) === compactName(d.recipient.name)) {
    issues.push('Sender name and recipient name must be checked separately.')
  }
  if (phoneDigits.length < 9 || phoneDigits.length > 12) {
    issues.push('Recipient phone number looks invalid.')
  }
  if (d.recipient.address.length < 8) {
    issues.push('Recipient address is required.')
  }
  if (d.recipient.city.length < 2) {
    issues.push('Recipient city is required.')
  }
  if (!d.recipient.date || Number.isNaN(new Date(d.recipient.date).getTime())) {
    issues.push('Delivery date is required.')
  }

  return issues
}

export function checkoutDetailsAreValid(details: CheckoutDetailsInput): boolean {
  return validateCheckoutDetails(details).length === 0
}

export function planHasSafeCheckoutDetails(plan: PlanBoard): boolean {
  const details: CheckoutDetailsInput = {
    senderName: clean(plan.sender_name),
    senderEmail: clean(plan.sender_email) || DEFAULT_SENDER_EMAIL,
    giftMessage: clean(plan.gift_message) || undefined,
    specialInstructions: clean(plan.special_instructions) || undefined,
    recipient: {
      name: clean(plan.recipient?.name),
      phone: clean(plan.recipient?.phone),
      address: clean(plan.recipient?.address),
      city: clean(plan.delivery?.city),
      date: clean(plan.delivery?.date),
    },
  }

  return checkoutDetailsAreValid(details)
}

export function forcePlanToCollectDetails(plan: PlanBoard): PlanBoard {
  return {
    ...plan,
    needs_recipient: true,
    recipient: {
      name: isLikelyRecipientPlaceholder(clean(plan.recipient?.name))
        ? null
        : clean(plan.recipient?.name) || null,
      phone: clean(plan.recipient?.phone) || null,
      address: clean(plan.recipient?.address) || null,
    },
  }
}
