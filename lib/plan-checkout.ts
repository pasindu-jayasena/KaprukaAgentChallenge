import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'
import { checkoutDetailsAreValid, normalizeCheckoutDetails } from '@/lib/checkout-validation'
import type { CheckoutDetailsInput, PlanBoard } from '@/types'

export function planToCheckoutDetails(
  plan: PlanBoard,
  override?: CheckoutDetailsInput
): CheckoutDetailsInput {
  if (override) return override

  return normalizeCheckoutDetails({
    senderName: plan.sender_name?.trim() || 'Kapruka Customer',
    senderEmail: plan.sender_email?.trim() || DEFAULT_SENDER_EMAIL,
    giftMessage: plan.gift_message?.trim() || undefined,
    specialInstructions: plan.special_instructions?.trim() || undefined,
    recipient: {
      name: plan.recipient?.name?.trim() || '',
      phone: plan.recipient?.phone?.trim() || '',
      address: plan.recipient?.address?.trim() || '',
      city: plan.delivery?.city?.trim() || '',
      date: plan.delivery?.date?.trim() || '',
    },
  })
}

export function planHasCompleteRecipient(plan: PlanBoard): boolean {
  const d = planToCheckoutDetails(plan)
  return checkoutDetailsAreValid(d)
}
