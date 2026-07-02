interface ChatTurn {
  role: string
  content: string
}

/** Build a compact "already known" block from chat history to stop repeat questions. */
export function buildConversationContext(messages: ChatTurn[]): string {
  const userLines = messages
    .filter((m) => m.role === 'user' && !m.content.includes('CHECKOUT_DETAILS:'))
    .map((m) => m.content.trim())
    .filter(Boolean)

  if (!userLines.length) return ''

  const joined = userLines.join('\n')
  const joinedLower = joined.toLowerCase()
  const facts: string[] = []

  // --- Shopping context extraction ---
  const budgetMatch = joined.match(/(?:rs\.?\s*|lkr\s*|under\s+|below\s+|budget\s+)(\d{3,7})|(\d{3,7})\s*(?:rs\.?|lkr|budget)/i)
  if (budgetMatch) {
    const val = budgetMatch[1] ?? budgetMatch[2]
    facts.push(`Budget established: Rs. ${Number(val).toLocaleString()}`)
  }
  if (/\b(no budget limit|no limit|budget limit na|budget ekak na)\b/i.test(joinedLower)) {
    facts.push('Budget: No limit set')
  }

  // Category
  if (/\b(chocolates?|choco|cadbury|ferrero)\b/i.test(joinedLower)) facts.push('Category interest: Chocolates')
  else if (/\b(flowers?|roses?|bouquet)\b/i.test(joinedLower)) facts.push('Category interest: Flowers')
  else if (/\b(cake|cakes)\b/i.test(joinedLower)) facts.push('Category interest: Cake')
  else if (/\b(perfume|fragrance)\b/i.test(joinedLower)) facts.push('Category interest: Perfume')
  else if (/\b(teddy|soft toy)\b/i.test(joinedLower)) facts.push('Category interest: Teddy/Soft toy')
  else if (/\b(grocer(?:y|ies)|rice|milk|daily essentials?)\b/i.test(joinedLower)) facts.push('Category interest: Groceries')
  else if (/\b(electronics?|phone|charger|cable)\b/i.test(joinedLower)) facts.push('Category interest: Electronics')

  // Recipient
  if (/\b(girlfriend|gf|kella|kellawa|crush)\b/i.test(joinedLower)) facts.push('Recipient: Girlfriend/crush')
  else if (/\b(wife|birida)\b/i.test(joinedLower)) facts.push('Recipient: Wife')
  else if (/\b(for myself|self shopping|mata ganna|mage gedarata)\b/i.test(joinedLower)) facts.push('Shopping mode: Self (not a gift)')
  else if (/\b(mother|mom|amma)\b/i.test(joinedLower)) facts.push('Recipient: Mother')
  else if (/\b(father|dad|thaththa)\b/i.test(joinedLower)) facts.push('Recipient: Father')
  else if (/\b(friend|yalu)\b/i.test(joinedLower)) facts.push('Recipient: Friend')

  // Mood / situation
  if (/\b(broke up|breakup|sorry|apology|forgive|tharaha|kopa)\b/i.test(joinedLower)) facts.push('Mood: Apology/sensitive situation')
  else if (/\b(sad|upset|duken|duka|heartbroken)\b/i.test(joinedLower)) facts.push('Mood: Sad/emotional')
  else if (/\b(birthday|anniversary|wedding)\b/i.test(joinedLower)) facts.push('Occasion: ' + (joinedLower.includes('birthday') ? 'Birthday' : joinedLower.includes('anniversary') ? 'Anniversary' : 'Wedding'))

  // --- Delivery/checkout context ---
  const phone = joined.match(/(?:\+94|0)\d{8,11}/)?.[0]
  if (phone) facts.push(`Phone mentioned: ${phone}`)

  const cities = [
    'colombo', 'kandy', 'galle', 'jaffna', 'negombo', 'matara',
    'kurunegala', 'anuradhapura', 'ratnapura', 'badulla',
    'trincomalee', 'batticaloa', 'ganemulla',
  ]
  for (const c of cities) {
    if (joinedLower.includes(c)) {
      facts.push(`City/area mentioned: ${c.charAt(0).toUpperCase() + c.slice(1)}`)
      break
    }
  }

  const colomboZone = joined.match(/colombo\s*0?\d/i)?.[0]
  if (colomboZone) facts.push(`Colombo zone: ${colomboZone}`)

  const datePatterns = joined.match(
    /\b(\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?(?:\s+of\s+\w+)?|\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi
  )
  if (datePatterns?.length) {
    facts.push(`Date mentioned: ${datePatterns[datePatterns.length - 1]}`)
  }

  const forMatch = joined.match(
    /(?:for my|to my|wife|husband|mother|father|friend|sister|brother|partner)\s+(\w+)/i
  )
  if (forMatch) facts.push(`Relationship context: ${forMatch[0]}`)

  const nameCandidates = joined.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g
  )
  if (nameCandidates?.length) {
    const skip = new Set(['I', 'The', 'For', 'My', 'Anu', 'Kapruka', 'Father', 'Mother', 'Under', 'Budget', 'Show', 'Raise', 'Track'])
    const names = nameCandidates.filter((n) => !skip.has(n.split(' ')[0]))
    if (names.length) facts.push(`Possible names: ${names.slice(-2).join(', ')}`)
  }

  if (joined.match(/\d+\s*\/\s*\d+/)) {
    const addr = userLines.find((l) => /\d/.test(l) && l.length > 15)
    if (addr) facts.push(`Address fragment: "${addr.slice(0, 80)}${addr.length > 80 ? '…' : ''}"`)
  }

  if (!facts.length) return ''

  return [
    '═══ ALREADY SAID IN THIS CHAT (do NOT re-ask) ═══',
    ...facts.map((f) => `• ${f}`),
    '',
    'RULES:',
    '• Use these facts silently — NEVER re-ask for something already established.',
    '• If budget was stated, use it for all searches until the customer changes it.',
    '• If products were already shown and they want different ones, search differently — do not re-show the same.',
    '• If budget was raised, immediately search with the new budget.',
  ].join('\n')
}

/** Friendly label for cart checkout handoff — never show raw CHECKOUT_DETAILS in UI. */
export function formatCheckoutUserDisplay(text: string): string {
  if (!text.includes('CHECKOUT_DETAILS:')) return text

  const name = text.match(/Name\s*=\s*([^;]+)/i)?.[1]?.trim()
  const city = text.match(/City\s*=\s*([^;]+)/i)?.[1]?.trim()
  const date = text.match(/Date\s*=\s*([^;]+)/i)?.[1]?.trim()

  const parts = ['Checkout details submitted']
  if (name) parts.push(`for ${name}`)
  if (city) parts.push(`→ ${city}`)
  if (date) parts.push(`on ${date}`)
  return parts.join(' ')
}

/** Replace structured checkout messages with a clean summary for the LLM. */
export function messagesForModel(
  messages: ChatTurn[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((m) => {
    if (m.role !== 'user' || !m.content.includes('CHECKOUT_DETAILS:')) {
      return { role: m.role as 'user' | 'assistant', content: m.content }
    }
    return {
      role: 'user' as const,
      content: `[Customer submitted checkout form] ${formatCheckoutUserDisplay(m.content)}. System is processing the order — respond with a brief warm confirmation only if needed.`,
    }
  })
}

/** Append shown-product names so follow-up questions can be answered without re-searching. */
export function enrichMessageForModel(message: {
  role: string
  content: string
  payload?: { type?: string; trio?: { products?: Array<{ name: string; price: number; pick?: boolean }> } }
}): string {
  if (message.role !== 'assistant' || message.payload?.type !== 'product_trio') {
    return message.content
  }
  const products = (message.payload.trio?.products ?? [])
    .slice(0, 6)
    .map((p) => `${p.name} Rs.${p.price}${p.pick ? ' [Anu pick]' : ''}`)
    .join('; ')
  if (!products) return message.content
  const base = message.content.trim()
  return base ? `${base}\n\n[Previously shown: ${products}]` : `[Previously shown: ${products}]`
}
