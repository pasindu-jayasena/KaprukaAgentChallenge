interface ChatTurn {
  role: string
  content: string
}

const NON_SHOPPING_PATTERNS: RegExp[] = [
  /\b(meken|meka|meke|mekata)\s+(hoda|hodama|best|lassana)\b/i,
  /\bhoda\s+mokakda\b/i,
  /\bwhich\s+(one\s+)?(is\s+)?(good|best|better)\b/i,
  /\b(best|better)\s+(one|pick|option)\b/i,
  /\b(will|would)\s+(she|he|they|kella|aya|eya)\s+(like|love|kamathi|kamti)\b/i,
  /\b(kamathi|kamti)\s+weida\b/i,
  /\b(like|love)\s+(this|me)\b/i,
  /\byalu\s+(kar|karan|wenna|ganna)\b/i,
  /\b(girlfriend|boyfriend|relationship)\b/i,
  /\b(broke\s+up|breakup|break\s+up|fight|argued|heartbroken)\b/i,
  /\bhow\s+(to|do\s+i)\s+(make|get|become|win)\b.*\b(friend|girl|boy|love|kella|yalu)\b/i,
  /\b(tharaha|kopa|upset|angry|forgive|sory|sorry)\b/i,
  /\bwhat\s+do\s+you\s+think\b/i,
  /\bexplain\b|\btell\s+me\s+why\b/i,
  /\b(compare|difference\s+between)\b/i,
  /\b(recommend|suggest)\s+(one|which)\b(?![\s\S]{0,40}\b(cake|gift|flower|chocolate|hamper)\b)/i,
]

const SHOPPING_PATTERNS: RegExp[] = [
  /\b(show|find|search|browse|look\s+for)\b/i,
  /\b(buy|order|add\s+to\s+cart|checkout)\b/i,
  /\b(need|want|looking\s+for)\b/i,
  /\b(one|ekak|tikak)\s+(bn|one|denna|anna|oné)\b/i,
  /\bgift\s+(for|ideas?|idea)\b/i,
  /\b(under|below|around|budget)\s+[\d,]+/i,
  /\b(birthday|anniversary|wedding|valentine)\s+(cake|gift|flower|hamper|present)\b/i,
  /\b(cake|flower|chocolate|hamper|teddy|perfume|fruit\s+basket|gift\s+box|balloon)s?\b/i,
  /\b(grocer(?:y|ies)|rice|milk|snacks?|electronics?|phone|charger|cable|dress|clothing|fashion|home\s+items?|daily\s+essentials?|fruits?|vegetables?)\b/i,
  /\boptions?\s+(for|under)\b/i,
  /\balternatives?\b/i,
]

const PRODUCT_NOUN =
  /\b(cake|flower|chocolate|hamper|teddy|perfume|gift|balloon|ribbon|fruit|wine|watch|jewell?ery|grocer(?:y|ies)|rice|milk|snack|electronics?|phone|charger|cable|dress|clothing|fashion|home\s+item|daily\s+essential|vegetable|appliance)\b/i

function recentAssistantLines(messages: ChatTurn[], count = 4): string[] {
  return messages
    .filter((m) => m.role === 'assistant')
    .slice(-count)
    .map((m) => m.content)
}

export function productsRecentlyShown(messages: ChatTurn[]): boolean {
  return recentAssistantLines(messages).some(
    (line) =>
      /\[previously shown:/i.test(line) ||
      /rs\.?\s*\d/i.test(line) ||
      /\banu'?s pick\b/i.test(line) ||
      /birthday cake|top picks|here are my/i.test(line)
  )
}

export function isCheckoutFailureFollowUp(userMessage: string, messages: ChatTurn[]): boolean {
  const msg = userMessage.trim()
  if (!msg) return false

  const recentAssistant = recentAssistantLines(messages, 5).join(' ')
  const recentCheckoutFailure =
    /could not get a payment link|payment link.*try again|checkout failed|verify delivery details|order could not be created|placing that order/i.test(
      recentAssistant
    )
  if (!recentCheckoutFailure) return false

  return /\b(what'?s|what is|why|issue|problem|reason|failed|fail|error|wrong|mokakda|ai|eyi|enna problem|enna issue)\b/i.test(
    msg
  )
}
/** True when the user is asking a question — not requesting new product options. */
export function isNonShoppingTurn(userMessage: string, messages: ChatTurn[]): boolean {
  const msg = userMessage.trim()
  if (!msg || msg.includes('CHECKOUT_DETAILS:')) return false

  if (isCheckoutFailureFollowUp(msg, messages)) return true

  const shoppingVerb = SHOPPING_PATTERNS.some((p) => p.test(msg))
  const productMention = PRODUCT_NOUN.test(msg)
  if (NON_SHOPPING_PATTERNS.some((p) => p.test(msg)) && !(shoppingVerb && productMention)) {
    return true
  }

  const lifeTopic =
    /\b(yalu|friend|girlfriend|boyfriend|kamathi|love|relationship|upset|angry|forgive|kohomada|kella)\b/i.test(
      msg
    )
  if (lifeTopic && !productMention && !shoppingVerb) return true

  if (productsRecentlyShown(messages)) {
    const followUp =
      /\b(meken|meka|meke|this|these|hoda|which|compare|difference|pick|choose|select)\b/i.test(
        msg
      )
    if (followUp && !SHOPPING_PATTERNS.some((p) => p.test(msg))) return true
  }

  return false
}

export function isExplicitShoppingIntent(userMessage: string): boolean {
  const msg = userMessage.trim()
  if (!msg) return false
  return SHOPPING_PATTERNS.some((p) => p.test(msg))
}

/** Injected into the system prompt for the current turn. */
export function buildIntentBlock(messages: ChatTurn[]): string {
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === 'user' && !m.content.includes('CHECKOUT_DETAILS:'))
  if (!lastUser) return ''

  if (isCheckoutFailureFollowUp(lastUser.content, messages)) {
    return [
      'THIS TURN - CHECKOUT FAILURE EXPLANATION',
      'The customer is asking why the payment link/order failed. Answer from recent checkout context, not as a new shopping request.',
      'Explain honestly that Kapruka did not return a valid payment link/order reference, so the safest next step is to verify phone, full address, city, delivery date, item availability, then try Confirm again.',
      'Do NOT search products. Do NOT ask for a new gift budget.',
    ].join('\n')
  }

  if (isNonShoppingTurn(lastUser.content, messages)) {
    return [
      '═══ THIS TURN — CONVERSATION ONLY ═══',
      'The latest customer message is a question or advice request — NOT a request to browse or buy.',
      '• Answer directly in 2–4 warm sentences. Give your opinion.',
      '• Do NOT call kapruka_search_products.',
      '• Do NOT output <PRODUCT_TRIO>.',
      '• If they ask which option is best from items you already showed, name one and explain why — do not search again.',
    ].join('\n')
  }

  if (isExplicitShoppingIntent(lastUser.content)) {
    return [
      '═══ THIS TURN — SHOPPING OK ═══',
      'Customer wants product options or buying help. You may search once, then show ONE <PRODUCT_TRIO>.',
      'Write your advice in plain text BEFORE the tag — never put your full answer only inside context.',
    ].join('\n')
  }

  if (productsRecentlyShown(messages)) {
    return [
      '═══ CONTEXT — PRODUCTS ALREADY ON SCREEN ═══',
      'Products were shown recently. Prefer answering in text unless they explicitly ask for new/different options.',
    ].join('\n')
  }

  return ''
}
