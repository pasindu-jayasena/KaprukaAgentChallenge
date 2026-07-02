interface ChatTurn {
  role: string
  content: string
}

/**
 * Check if products were recently shown in the conversation.
 * This is a lightweight heuristic used to help the LLM know it has
 * products on screen — the LLM decides what to do with this info.
 */
export function productsRecentlyShown(messages: ChatTurn[]): boolean {
  const recentAssistant = messages
    .filter((m) => m.role === 'assistant')
    .slice(-4)
    .map((m) => m.content)

  return recentAssistant.some(
    (line) =>
      /\[previously shown:/i.test(line) ||
      /PRODUCT_TRIO/i.test(line) ||
      /anu'?s pick/i.test(line)
  )
}

/**
 * Check if the recent conversation had a checkout failure.
 * Used to provide context to the LLM so it can explain the failure.
 */
export function recentCheckoutFailed(messages: ChatTurn[]): boolean {
  const recentAssistant = messages
    .filter((m) => m.role === 'assistant')
    .slice(-5)
    .map((m) => m.content)
    .join(' ')

  return /could not get a payment link|payment link.*try again|checkout failed|verify delivery details|order could not be created|placing that order/i.test(
    recentAssistant
  )
}

/**
 * Build a context hint block injected into the system prompt.
 *
 * This tells the LLM about the current conversation state so it can
 * make informed decisions. It does NOT gatekeep or restrict the LLM —
 * the LLM is the brain and decides what to do.
 */
export function buildIntentBlock(messages: ChatTurn[]): string {
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === 'user' && !m.content.includes('CHECKOUT_DETAILS:'))
  if (!lastUser) return ''

  const hints: string[] = []

  // Context: checkout failure
  if (recentCheckoutFailed(messages)) {
    hints.push(
      '⚠ CONTEXT: A recent checkout failed. If the customer is asking about it, explain honestly and help fix details.',
      'Do NOT search products. Help them verify phone, address, city, date, then retry.'
    )
  }

  // Context: products on screen
  if (productsRecentlyShown(messages)) {
    hints.push(
      '📋 CONTEXT: Products are currently shown on screen.',
      'If the customer is asking about the shown products (comparing, asking which is best), answer from what you showed — don\'t search again.',
      'If they want different/new options, then search.'
    )
  }

  if (!hints.length) return ''

  return ['═══ SITUATION CONTEXT ═══', ...hints].join('\n')
}

// Keep these exports for backward compatibility — other files may import them
export function isNonShoppingTurn(userMessage: string, messages: ChatTurn[]): boolean {
  // Simplified: only return true for very obvious non-shopping turns
  // The LLM handles the nuanced cases now
  const msg = userMessage.trim()
  if (!msg || msg.includes('CHECKOUT_DETAILS:')) return false

  // Only catch clearly non-shopping messages that have zero product mentions
  const hasProduct = /\b(cake|flower|chocolate|gift|hamper|teddy|perfume|grocer|rice|milk|electronics?|phone|charger|dress)\b/i.test(msg)
  if (hasProduct) return false

  // Obvious advice/emotional questions
  if (/\b(will she|would she|should i|what do you think|forgive|broke up|breakup|sorry|angry|tharaha|kopa)\b/i.test(msg)) return true
  if (/\b(meken|meka|meke).*(hoda|best|better)\b/i.test(msg)) return true

  return false
}

export function isCheckoutFailureFollowUp(userMessage: string, messages: ChatTurn[]): boolean {
  if (!recentCheckoutFailed(messages)) return false
  return /\b(what|why|issue|problem|reason|failed|fail|error|wrong|mokakda)\b/i.test(userMessage)
}

export function isExplicitShoppingIntent(userMessage: string): boolean {
  const msg = userMessage.trim()
  if (!msg) return false
  return /\b(show|find|search|browse|buy|order|need|want|looking|gift|under|below|budget)\b/i.test(msg)
}
