import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'
import { isLikelyRecipientPlaceholder } from '@/lib/checkout-validation'
import type { CartItem, ChatLang, ChatPayload, CheckoutDetailsInput } from '@/types'

interface ChatTurn {
  role: string
  content: string
}

export type ConversationMode =
  | 'shopping'
  | 'checkout_collecting'
  | 'checkout_review'
  | 'paid_or_payment_link'
  | 'tracking_collecting'

export interface TrackingContext {
  mode: ConversationMode
}

export interface CheckoutContinuation {
  payload?: ChatPayload
  details?: CheckoutDetailsInput
}

interface CheckoutDraft {
  recipientName?: string
  phone?: string
  address?: string
  city?: string
  date?: string
  senderName?: string
  senderEmail?: string
  giftMessage?: string
  specialInstructions?: string
  askedGiftMessage?: boolean
  askedSpecialInstructions?: boolean
}

// "No", "No, skip", "no thanks", "epa", "venda", "නෑ" … all mean skip.
// Short replies that LEAD with a negative word are a skip; longer text that
// merely starts with "No" ("No one loves you like I do") is a real message.
const SKIP_LEAD_WORDS = new Set([
  'no', 'nope', 'nah', 'skip', 'epa', 'na', 'naa', 'nahi', 'venda', 'none',
  'එපා', 'නෑ', 'නැහැ', 'නැත', 'வேண்டாம்', 'இல்லை',
])

function isSkipReply(text: string) {
  // Strip ALL punctuation ("No, skip" → "no skip") before tokenizing
  const tokens = text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!tokens.length) return true
  return SKIP_LEAD_WORDS.has(tokens[0]) && tokens.length <= 3
}

function clean(text: string) {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s@./,'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripCheckoutMarker(text: string) {
  return text.replace(/CHECKOUT_DETAILS:[\s\S]*?(?=\n\n|$)/gi, '').trim()
}

function lastAssistant(messages: ChatTurn[]) {
  return [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''
}

function recentText(messages: ChatTurn[], count = 8) {
  return messages.slice(-count).map((m) => stripCheckoutMarker(m.content)).join(' ')
}

export function inferConversationMode(messages: ChatTurn[], cart: CartItem[]): ConversationMode {
  const last = clean(lastAssistant(messages))
  const recent = clean(recentText(messages))

  if (/\b(order number|tracking number|send me your kapruka order|track karanna order number|order track panna order number)\b/.test(last)) {
    return 'tracking_collecting'
  }
  if (/\b(recipient address is required|recipient phone number looks invalid|recipient actual name is required|delivery date is required|sender name is required)\b/.test(last)) {
    return 'checkout_collecting'
  }
  if (/\b(payment link|order ready for payment|complete the payment|thank you for choosing kapruka)\b/.test(recent)) {
    return 'paid_or_payment_link'
  }
  if (/\b(review your order|prepare the order review|tap confirm|confirm to get your kapruka payment link)\b/.test(recent)) {
    return 'checkout_review'
  }

  // Budget negotiation — don't misclassify as checkout
  const isBudgetNegotiation =
    /\b(raise budget|increase budget|budget eka wadi|simpler options|cheaper|no budget limit|budget limit na|budget ekak na|budget increase|wadi karanna)\b/.test(recent) ||
    /\b(could not find|hambune naha|hambune na|kidaikkala|gift.quality options)\b/.test(last)
  if (isBudgetNegotiation) return 'shopping'

  // Checkout collection starts ONLY from the CUSTOMER's own words — never
  // because Anu merely suggested "…or checkout now?" in a reply. Once started,
  // it continues while the last assistant turn is an actual collection question.
  const lastUserText = clean(
    [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  )
  const userWantsCheckout =
    /\b(checkout|check out|buy now|place (the |my )?order|proceed to pay|pay now|ready to pay)\b/.test(lastUserText) ||
    /\b(checkout karanna|checkout karannada|checkout pannalama|order karanna|order pannunga)\b/.test(lastUserText)
  const assistantIsCollecting =
    /\b(who should receive|receive this order|recipient name|phone number|delivery address|which city|delivery date|who is sending|personal message|special delivery instructions)\b/.test(last) ||
    /\b(gift eka katada|receive karanne katada|ewannako|anuppunga)\b/.test(last)

  return cart.length > 0 && (userWantsCheckout || assistantIsCollecting)
    ? 'checkout_collecting'
    : 'shopping'
}

/**
 * Mid-collection, the customer may change their mind: "Add more items",
 * "show me chocolates", "wait", "cancel". Those are NOT answers to the
 * current question — hand the turn to the LLM instead of re-asking.
 */
export function wantsToLeaveCheckout(text: string): boolean {
  const t = clean(text)
  return (
    /\b(add more|more items|add (something|anything) else|show me|show more|find|search|browse|something else|different|not now|later|cancel|stop|wait|hold on)\b/.test(t) ||
    /\b(thawa|wena ekak|passe|nawathanna|epa checkout|innum|vera|venda checkout)\b/.test(t)
  )
}

function looksLikeRecipientName(text: string) {
  const t = clean(text).replace(/^(for|to)\s+(my|the)?\s*/i, '').trim()
  if (!t || t.length < 2) return false
  if (isLikelyRecipientPlaceholder(t)) return false
  if (/\d/.test(t)) return false
  if (/\b(checkout|track|order|phone|address|city|date)\b/.test(t)) return false
  return t.split(/\s+/).length <= 4
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?94|0)?\d[\d\s-]{7,12}\d/)
  return match?.[0]?.replace(/[^\d+]/g, '') ?? undefined
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
}

function extractDate(text: string) {
  const t = clean(text)
  const explicit = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/)
  if (explicit) return explicit[1].replace(/\//g, '-')
  const dayMonth = text.match(/\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b/)
  if (dayMonth) {
    const now = new Date()
    const year = now.getFullYear()
    const month = dayMonth[2].padStart(2, '0')
    const day = dayMonth[1].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (/\btomorrow|heta|naalai\b/.test(t)) return colomboDateOffset(1)
  if (/\btoday|ada|indru\b/.test(t)) return colomboDateOffset(0)
  return undefined
}

function colomboDateOffset(days: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return d.toISOString().slice(0, 10)
}

function splitDetails(text: string) {
  return text
    .split(/[,\n;]/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function extractCity(text: string, phone?: string) {
  const parts = splitDetails(phone ? text.replace(phone, '') : text)
  const city = [...parts].reverse().find((p) => /[a-zA-Z\u0d80-\u0dff\u0b80-\u0bff]/.test(p) && p.length <= 40)
  return city?.replace(/\b(city|town)\b/gi, '').trim()
}

function extractAddress(text: string, phone?: string, city?: string) {
  let value = text
  if (phone) value = value.replace(phone, '')
  if (city) value = value.replace(city, '')
  value = value.replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*/g, ', ')
  if (value.length < 3) return undefined
  return value
}

function hasFullAddress(address?: string) {
  const value = String(address ?? '').trim()
  const compact = value.replace(/[^a-z0-9]/gi, '')
  return value.length >= 8 && compact.length >= 5
}

function mergeFieldAnswer(draft: CheckoutDraft, assistantText: string, userText: string) {
  const ask = clean(assistantText)
  const text = userText.trim()
  const phone = extractPhone(text)
  const date = extractDate(text)
  const email = extractEmail(text)

  if (/\b(who should receive|recipient name|receive this order|gift eka katada|katada)\b/.test(ask) && looksLikeRecipientName(text)) {
    draft.recipientName = text
    return
  }

  if (/\b(phone number|delivery address|which city|address|city|deliver to)\b/.test(ask)) {
    if (phone) draft.phone = phone
    const city = extractCity(text, phone)
    if (city) draft.city = city
    const address = extractAddress(text, phone, city)
    if (address) draft.address = address
    return
  }

  if (/\b(delivery date|deliver date|which date|date)\b/.test(ask)) {
    if (date) draft.date = date
    return
  }

  if (/\b(sender|who is sending|your name|from who)\b/.test(ask)) {
    if (email) draft.senderEmail = email
    const name = text.replace(email ?? '', '').replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim()
    if (looksLikeRecipientName(name)) draft.senderName = name
    return
  }

  // Special delivery instructions collection step (own question, after the gift message)
  if (/\b(special|delivery)\s+instructions?\b/.test(ask)) {
    draft.askedSpecialInstructions = true
    if (!isSkipReply(text)) draft.specialInstructions = text.trim()
    return
  }

  // Personal/gift message collection step
  if (/\b(personal message|gift message|card message|handwritten)\b/.test(ask)) {
    draft.askedGiftMessage = true
    if (isSkipReply(text)) return
    // If the customer volunteers both at once ("Happy Birthday! instructions: call first")
    const instrMatch = text.match(/(?:special\s*instructions?|delivery\s*instructions?|instructions?)\s*[:=]\s*(.+)/i)
    if (instrMatch) {
      draft.specialInstructions = instrMatch[1].trim()
      draft.askedSpecialInstructions = true
      const msgPart = text.slice(0, instrMatch.index).replace(/[,;\s]+$/, '').trim()
      if (msgPart && msgPart.length > 1) draft.giftMessage = msgPart
    } else {
      draft.giftMessage = text.trim()
    }
    return
  }

  if (phone && !draft.phone) draft.phone = phone
  if (date && !draft.date) draft.date = date
}

export function collectCheckoutDraft(messages: ChatTurn[]): CheckoutDraft {
  const draft: CheckoutDraft = {}
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    const prevAssistant = [...messages.slice(0, i)].reverse().find((m) => m.role === 'assistant')?.content ?? ''
    mergeFieldAnswer(draft, prevAssistant, stripCheckoutMarker(msg.content))
  }
  return draft
}

/** Ask ONLY for the contact fields that are still missing — never re-ask what the customer already gave. */
function contactAskText(draft: CheckoutDraft, chatLang: ChatLang) {
  const name = draft.recipientName || 'the recipient'
  const missing: Array<'phone' | 'address' | 'city'> = []
  if (!draft.phone) missing.push('phone')
  if (!draft.address) missing.push('address')
  if (!draft.city) missing.push('city')

  const labels: Record<ChatLang | 'en', Record<'phone' | 'address' | 'city', string>> = {
    en: { phone: 'phone number', address: 'delivery address', city: 'city' },
    si: { phone: 'phone number eka', address: 'delivery address eka', city: 'city eka' },
    singlish: { phone: 'phone number eka', address: 'delivery address eka', city: 'city eka' },
    ta: { phone: 'phone number', address: 'delivery address', city: 'city' },
    tanglish: { phone: 'phone number', address: 'delivery address', city: 'city' },
  }
  const parts = missing.map((m) => labels[chatLang]?.[m] ?? labels.en[m])
  const enJoin =
    parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

  if (chatLang === 'singlish' || chatLang === 'si') {
    return `Got it. ${name} ge ${parts.join(', ')} ewannako.`
  }
  if (chatLang === 'tanglish' || chatLang === 'ta') {
    return `Got it. ${name} oda ${parts.join(', ')} anuppunga.`
  }
  return `Got it. What is ${name}'s ${enJoin}?`
}

function askText(missing: string, draft: CheckoutDraft, chatLang: ChatLang) {
  const name = draft.recipientName || 'the recipient'
  if (missing === 'contact') return contactAskText(draft, chatLang)
  if (chatLang === 'singlish' || chatLang === 'si') {
    if (missing === 'name') return 'Checkout karanna kalin actual recipient name eka denna. Gift eka receive karanne katada?'
    if (missing === 'address') return 'Address eka poddak madi. House number, road/lane name ekka full delivery address eka ewannako.'
    if (missing === 'date') return 'Delivery date eka mokakda? Tomorrow da, nathnam specific date ekakda?'
    if (missing === 'sender') return 'Sender name eka ewannako. Email ekath ewanna puluwan (optional).'
    if (missing === 'special') return `Special delivery instructions monawa hari tiyenawada? (e.g. deliver karanna kalin call karanna) Nathnam "No" kiyannako.`
    return `Almost done! ${name} ta personal message ekak liyannada? Skip karanna "No" kiyannako.`
  }
  if (chatLang === 'tanglish' || chatLang === 'ta') {
    if (missing === 'name') return 'Checkout panna actual recipient name venum. Yaarukku deliver panna?'
    if (missing === 'address') return 'Address konjam short-a irukku. House number, road/lane name oda full delivery address anuppunga.'
    if (missing === 'date') return 'Delivery date enna? Tomorrow-aa, illa specific date-aa?'
    if (missing === 'sender') return 'Sender name anuppunga. Email optional-a anuppalaam.'
    if (missing === 'special') return `Special delivery instructions edhavadhu irukka? (e.g. deliver panna munnadi call pannunga) Illena "No" sollunga.`
    return `Almost done! ${name}-ku personal message ezhuthanuuma? Skip panna "No" sollunga.`
  }
  if (missing === 'name') return 'Sure. Who should receive this order? Please send the actual recipient name.'
  if (missing === 'address') return 'That address is a bit too short. Please send the full delivery address with house number and road or lane name.'
  if (missing === 'date') return 'What delivery date should I use? You can say tomorrow or send a specific date.'
  if (missing === 'sender') return 'Who is sending this? Send your name and email (email is optional).'
  if (missing === 'special') return `Any special delivery instructions? (e.g. call before delivery, leave with security) Type "No" to skip.`
  return `Almost done! Would you like to add a personal message for ${name}? Type "No" to skip.`
}

export function continueCheckoutCollection(
  messages: ChatTurn[],
  cart: CartItem[],
  chatLang: ChatLang
): CheckoutContinuation | null {
  if (!cart.length || inferConversationMode(messages, cart) !== 'checkout_collecting') return null

  // Customer changed their mind mid-checkout ("Add more items", "show me…",
  // "wait") — this is not an answer, so hand the turn to the LLM.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (lastUser && wantsToLeaveCheckout(stripCheckoutMarker(lastUser.content))) return null

  const draft = collectCheckoutDraft(messages)
  const missing =
    !draft.recipientName ? 'name' :
    !draft.phone || !draft.address || !draft.city ? 'contact' :
    !hasFullAddress(draft.address) ? 'address' :
    !draft.date ? 'date' :
    !draft.senderName ? 'sender' :
    !draft.askedGiftMessage ? 'giftMessage' :
    !draft.askedSpecialInstructions ? 'special' :
    null

  if (missing) {
    const ask = askText(missing, draft, chatLang)
    // The customer's reply didn't advance the draft at all — asking the exact
    // same question again is a loop. Let the LLM read what they actually said.
    if (clean(ask) === clean(lastAssistant(messages))) return null
    return {
      payload: {
        type: 'chat',
        text: ask,
        chips: missing === 'date' ? ['Tomorrow', 'This weekend'] :
               missing === 'giftMessage' ? ['No, skip', 'Happy Birthday!', 'With love'] :
               missing === 'special' ? ['No, skip', 'Call before delivery'] :
               undefined,
      },
    }
  }

  return {
    details: {
      senderName: draft.senderName!,
      senderEmail: draft.senderEmail || DEFAULT_SENDER_EMAIL,
      giftMessage: draft.giftMessage,
      specialInstructions: draft.specialInstructions,
      recipient: {
        name: draft.recipientName!,
        phone: draft.phone!,
        address: draft.address!,
        city: draft.city!,
        date: draft.date!,
      },
    },
  }
}

