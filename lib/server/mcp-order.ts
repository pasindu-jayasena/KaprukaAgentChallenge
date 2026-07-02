/** Kapruka MCP kapruka_create_order accepts a strict schema — sanitize LLM + form payloads. */

import { polishSinglishText } from '@/lib/prompts/singlish-style'

export function sanitizeCreateOrderArgs(
  args: Record<string, unknown>
): Record<string, unknown> {
  const cart = Array.isArray(args.cart) ? args.cart : []
  const recipient =
    args.recipient && typeof args.recipient === 'object'
      ? { ...(args.recipient as Record<string, unknown>) }
      : {}
  const deliveryIn =
    args.delivery && typeof args.delivery === 'object'
      ? (args.delivery as Record<string, unknown>)
      : {}
  const senderIn =
    args.sender && typeof args.sender === 'object'
      ? (args.sender as Record<string, unknown>)
      : {}

  const delivery: Record<string, unknown> = {
    address: String(deliveryIn.address ?? ''),
    city: String(deliveryIn.city ?? ''),
    date: String(deliveryIn.date ?? deliveryIn.delivery_date ?? ''),
  }

  const instructions =
    deliveryIn.instructions ??
    deliveryIn.special_instructions ??
    args.special_instructions

  if (instructions && String(instructions).trim()) {
    delivery.instructions = String(instructions).trim()
  }

  const sender: Record<string, unknown> = {
    name: String(senderIn.name ?? recipient.name ?? 'Kapruka Customer'),
    email: String(senderIn.email ?? args.sender_email ?? args.senderEmail ?? 'guest@kapruka.com'),
    anonymous: senderIn.anonymous === true,
  }

  const out: Record<string, unknown> = {
    cart,
    recipient: {
      name: String(recipient.name ?? ''),
      phone: String(recipient.phone ?? ''),
    },
    delivery,
    sender,
    currency: args.currency ?? 'LKR',
    response_format: 'json',
  }

  const giftMessage = args.gift_message ?? args.giftMessage
  if (giftMessage && String(giftMessage).trim()) {
    out.gift_message = String(giftMessage).trim()
  }

  return out
}

export function sanitizeToolOutput(toolName: string, output: string): string {
  const trimmed = output.trim()
  if (!trimmed.startsWith('Error')) return output

  if (toolName === 'kapruka_create_order') {
    if (trimmed.includes('city_not_deliverable')) {
      return JSON.stringify({
        error: 'city_not_deliverable',
        message: 'That city is not in the delivery network. Suggest nearby cities.',
      })
    }
    return JSON.stringify({
      error: 'order_failed',
      message:
        'Order could not be created. Ask the customer to verify phone, full address, city, and delivery date.',
    })
  }

  return JSON.stringify({
    error: 'tool_failed',
    message: 'Tool call failed. Try again or use a different approach.',
  })
}

export function sanitizeAssistantText(text: string): string {
  const lower = text.toLowerCase()
  if (
    lower.includes('validation error') ||
    lower.includes('pydantic') ||
    lower.includes('extra_forbidden') ||
    lower.includes('error executing tool') ||
    lower.includes('kapruka_create_orderarguments')
  ) {
    return 'Oops, something went wrong placing that order. Can you double-check the phone number and delivery address for me?'
  }
  return polishSinglishText(text)
}
