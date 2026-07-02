import { runAgenticShoppingShortcut } from '@/lib/agentic-shopping'
import type { ChatLang, ChatPayload } from '@/types'
import type { KaprukaMCPClient } from '@/lib/server/mcp-client'

type StatusEmitter = (name: string, args?: Record<string, unknown>) => void

type Intent = 'self_shop' | 'gift_shop' | 'emotional_gift' | 'unknown'
type Category = 'chocolate' | 'flowers' | 'note_card' | 'groceries' | 'electronics' | 'home' | 'cake' | 'perfume' | 'teddy' | 'gift'

interface ChatTurn {
  role: string
  content: string
}

interface SearchProduct {
  id?: string
  name?: string
  summary?: string
  price?: number | { amount?: number; currency?: string }
  image_url?: string | null
  url?: string | null
  in_stock?: boolean
}

interface SearchResponse {
  results?: SearchProduct[]
}

interface Slots {
  intent: Intent
  category?: Category
  recipient?: 'girlfriend' | 'wife' | 'partner' | 'self' | 'other'
  budget?: number
  mood?: 'sad' | 'apology' | 'romantic' | 'practical'
  simple?: boolean
  broad: boolean
  noBudgetLimit?: boolean
  budgetRaised?: boolean
}

function normalize(text: string) {
  return text.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
}

function memory(messages?: ChatTurn[], role?: string) {
  return (messages ?? [])
    .filter((m) => (!role || m.role === role) && !m.content.includes('CHECKOUT_DETAILS:'))
    .slice(-8)
    .map((m) => m.content)
    .join(' ')
}

function parseBudget(text: string) {
  const normalized = normalize(text).replace(/,/g, '')
  const explicit = normalized.match(/(?:rs\.?|lkr|under|below|budget|yata|adu|less than|up to)\s*(\d{3,7})|\b(\d{3,7})\b\s*(?:rs\.?|lkr|budget|yata|under)/i)
  const explicitValue = Number(explicit?.[1] ?? explicit?.[2] ?? 0)
  if (Number.isFinite(explicitValue) && explicitValue > 0) return explicitValue

  const bareNumbers = [...normalized.matchAll(/\b(\d{3,7})\b/g)].map((m) => Number(m[1]))
  const likelyBudget = bareNumbers.find((n) => n >= 500 && n <= 500000)
  return likelyBudget && Number.isFinite(likelyBudget) ? likelyBudget : undefined
}

function categoryOf(text: string): Category | undefined {
  if (/\b(chocolates?|choco|cadbury|ferrero|kandos|toblerone)\b/.test(text)) return 'chocolate'
  if (/\b(flowers?|roses?|rose|mal|bouquet)\b/.test(text)) return 'flowers'
  if (/\b(note card|greeting card|sorry card|apology card|card ekak)\b/.test(text)) return 'note_card'
  if (/\b(cake|cakes|birthday cake)\b/.test(text)) return 'cake'
  if (/\b(perfume|fragrance)\b/.test(text)) return 'perfume'
  if (/\b(teddy|soft toy)\b/.test(text)) return 'teddy'
  if (/\b(grocer(?:y|ies)|rice|milk|dhal|dal|weekly|daily essentials?|gedarata)\b/.test(text)) return 'groceries'
  if (/\b(phone charger|charger|cable|electronics?|power bank|adapter|headset|earbuds)\b/.test(text)) return 'electronics'
  if (/\b(home item|room item|bedsheet|lamp|organizer|appliance|kitchen)\b/.test(text)) return 'home'
  if (/\b(gift|present|surprise)\b/.test(text)) return 'gift'
  return undefined
}

function recipientOf(text: string): Slots['recipient'] | undefined {
  if (/\b(girlfriend|gf|kella|kellawa|crush)\b/.test(text)) return 'girlfriend'
  if (/\b(wife|birida)\b/.test(text)) return 'wife'
  if (/\b(partner|lover|love|eyata|eya|her|she)\b/.test(text)) return 'partner'
  if (/\b(for myself|self shopping|mata ganna|mage gedarata|for me)\b/.test(text)) return 'self'
  if (/\b(friend|mother|mom|amma|father|dad|kid|child|recipient)\b/.test(text)) return 'other'
  return undefined
}

function classify(text: string, messages?: ChatTurn[]): Slots {
  const now = normalize(text)
  const all = normalize(text + ' ' + memory(messages, 'user'))
  const category = categoryOf(now) ?? categoryOf(all)
  const recipient = recipientOf(all)
  const noBudgetLimit = /\b(no budget limit|no limit|budget limit na|budget ekak na|limit naha|budget illai)\b/.test(now)
  // Current message budget ALWAYS takes priority over conversation history
  const currentBudget = parseBudget(now)
  const historyBudget = parseBudget(memory(messages, 'user'))
  const budget = noBudgetLimit ? undefined : currentBudget ?? historyBudget
  const budgetRaised = !!currentBudget && !!historyBudget && currentBudget > historyBudget
  const emotional = /\b(broke up|breakup|sorry|apology|forgive|sad|upset|heartbroken|duken|duka|tharaha|yalu karaganna|yalukaraganna)\b/.test(all)
  const gift = /\b(gift|send|surprise|girlfriend|wife|birthday|anniversary|eyata|kellawa|recipient|denna)\b/.test(all)
  const self = /\b(for myself|self shopping|weekly|grocer(?:y|ies)|daily essentials?|rice|milk|phone charger|charger|electronics?|home item|room item|mata ganna|mage gedarata)\b/.test(all)
  const simple = /\b(simpler options?|simple|cheaper|low budget|aduma|adu ganan|budget option|budget adu)\b/.test(now)
  let intent: Intent = 'unknown'
  if (emotional && gift) intent = 'emotional_gift'
  else if (self && !gift) intent = 'self_shop'
  else if (gift || (category && recipient !== 'self')) intent = 'gift_shop'
  else if (category && self) intent = 'self_shop'

  return {
    intent,
    category,
    recipient,
    budget,
    mood: emotional ? 'sad' : recipient === 'girlfriend' || recipient === 'wife' || recipient === 'partner' ? 'romantic' : self ? 'practical' : undefined,
    simple,
    broad: (intent === 'gift_shop' || intent === 'emotional_gift') && (!category || category === 'gift'),
    noBudgetLimit,
    budgetRaised,
  }
}

function extractJson(text: string): SearchResponse | null {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed) as SearchResponse
  } catch {
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first < 0 || last <= first) return null
    try {
      return JSON.parse(trimmed.slice(first, last + 1)) as SearchResponse
    } catch {
      return null
    }
  }
}

function priceOf(price: SearchProduct['price']) {
  if (typeof price === 'number') return price
  if (price && typeof price === 'object') return Number(price.amount ?? 0)
  return 0
}

function productText(p: SearchProduct) {
  return String(p.name ?? '') + ' ' + String(p.summary ?? '')
}

function badRomanticProduct(text: string) {
  return /\b(snackers?|biscuits?|chips?|short\s?cake|savoury|cheese|chillie|cracker|for\s+men|men'?s|mens|male|husband|father|dad|boyfriend)\b/i.test(text)
}

function matches(p: SearchProduct, slots: Slots) {
  const hay = productText(p)
  if (p.in_stock === false) return false
  const romantic = slots.recipient === 'girlfriend' || slots.recipient === 'wife' || slots.recipient === 'partner'
  if (romantic && badRomanticProduct(hay)) return false
  if (slots.category === 'chocolate') return /\b(chocolate|choco|cadbury|ferrero|kandos|toblerone|kit\s?kat|mars|bounty|snickers|galaxy)\b/i.test(hay) && !badRomanticProduct(hay)
  if (slots.category === 'flowers') return /\b(flower|rose|bouquet|orchid|lily)\b/i.test(hay)
  if (slots.category === 'note_card') return /\b(note card|greeting card|card|apology card|sorry card)\b/i.test(hay)
  if (slots.category === 'groceries') return /\b(rice|milk|dhal|dal|sugar|tea|grocery|essential|oil)\b/i.test(hay)
  if (slots.category === 'electronics') return /\b(charger|cable|adapter|power bank|electronics|headset|earbuds|phone)\b/i.test(hay)
  if (slots.category === 'home') return /\b(home|room|kitchen|lamp|organizer|bedsheet|towel|appliance)\b/i.test(hay)
  if (slots.category === 'cake') return /\b(cake|gateau|birthday cake)\b/i.test(hay)
  if (slots.category === 'perfume') return /\b(perfume|fragrance)\b/i.test(hay)
  if (slots.category === 'teddy') return /\b(teddy|soft toy|plush)\b/i.test(hay)
  return true
}

function query(slots: Slots) {
  if (slots.intent === 'self_shop') {
    if (slots.category === 'groceries') return 'rice milk groceries daily essentials'
    if (slots.category === 'electronics') return 'phone charger cable power bank adapter electronics'
    if (slots.category === 'home') return 'useful home room item organizer lamp kitchen'
    return 'daily essentials groceries electronics home items'
  }
  if (slots.category === 'chocolate') return slots.simple ? 'cadbury kandos toblerone kit kat chocolate' : 'chocolate gift for her cadbury ferrero hamper'
  if (slots.category === 'flowers') return 'rose flowers bouquet'
  if (slots.category === 'note_card') return 'greeting card note card apology card'
  if (slots.category === 'cake') return 'birthday cake'
  if (slots.category === 'perfume') return 'perfume gift for her'
  if (slots.category === 'teddy') return 'teddy bear gift'
  return 'gift for her chocolate flowers teddy perfume'
}

function backupQuery(slots: Slots) {
  if (slots.category === 'chocolate') return slots.simple ? 'chocolate cadbury kandos kit kat' : 'chocolate hamper bouquet gift box'
  if (slots.category === 'flowers') return 'flowers rose bouquet'
  if (slots.category === 'groceries') return 'groceries essentials rice dhal milk'
  if (slots.category === 'electronics') return 'charger adapter cable power bank'
  return 'kapruka gift hamper'
}

/** Broader fallback queries when budget-specific search fails */
function broaderQuery(slots: Slots) {
  if (slots.category === 'chocolate') return 'chocolate'
  if (slots.category === 'flowers') return 'flowers'
  if (slots.category === 'cake') return 'cake'
  if (slots.category === 'perfume') return 'perfume'
  if (slots.category === 'teddy') return 'teddy'
  if (slots.category === 'groceries') return 'groceries'
  if (slots.category === 'electronics') return 'electronics'
  return 'gift'
}

/** Try multiple search strategies before giving up on budget */
async function searchWithRetry(mcp: KaprukaMCPClient, slots: Slots, emit: StatusEmitter): Promise<SearchProduct[]> {
  // Strategy 1: Normal query with budget
  const first = await search(mcp, query(slots), slots.budget, emit)
  let filtered = first.filter((p) => matches(p, slots))
  if (filtered.length >= 2) return filtered

  // Strategy 2: Backup query with budget
  const backup = await search(mcp, backupQuery(slots), slots.budget, emit)
  filtered = [...filtered, ...backup.filter((p) => matches(p, slots))]
  if (filtered.length >= 2) return filtered

  // Strategy 3: Broader query with budget (less strict matching)
  const broader = await search(mcp, broaderQuery(slots), slots.budget, emit)
  const broaderFiltered = broader.filter((p) => p.id && p.name && p.in_stock !== false)
  if (broaderFiltered.length > 0) return [...filtered, ...broaderFiltered]

  // Strategy 4: Search without budget limit but show closest to budget
  if (slots.budget) {
    const noBudget = await search(mcp, query(slots), undefined, emit)
    const withinRange = noBudget
      .filter((p) => matches(p, slots))
      .filter((p) => {
        const price = priceOf(p.price)
        // Allow up to 30% over budget — show closest options
        return price <= slots.budget! * 1.3
      })
    if (withinRange.length > 0) return withinRange
  }

  return filtered
}

async function search(mcp: KaprukaMCPClient, q: string, budget: number | undefined, emit: StatusEmitter) {
  emit('kapruka_search_products', { q, max_price: budget, limit: 10 })
  const raw = await mcp.callTool('kapruka_search_products', { q, ...(budget ? { max_price: budget } : {}), limit: 10 })
  return extractJson(raw)?.results ?? []
}

function toProducts(results: SearchProduct[], slots: Slots) {
  const seen = new Set<string>()
  return results
    .filter((p) => p.id && p.name && p.in_stock !== false)
    .filter((p) => !slots.budget || priceOf(p.price) <= slots.budget)
    .map((p, index) => ({
      id: String(p.id),
      name: String(p.name),
      price: priceOf(p.price),
      image: p.image_url ?? null,
      url: p.url ?? null,
      pick: index === 0,
      in_stock: true,
      reason: slots.intent === 'self_shop'
        ? index === 0 ? 'Good practical base item for the basket.' : 'Useful add-on if the budget still has room.'
        : index === 0 ? 'Feels like a proper gift, not a random item.' : 'A safe gift-style option for this request.',
      description: String(p.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
    }))
    .filter((p) => {
      if (!p.price || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
    .slice(0, 6)
}

function askPayload(slots: Slots, chatLang: ChatLang): ChatPayload {
  if (slots.intent === 'self_shop') {
    if (chatLang === 'singlish' || chatLang === 'si') return { type: 'chat', text: 'Hari, oyata ganna nam practical widihata yamu. Mokakda main deya - groceries, electronics, fashion, nathnam home items? Budget eka roughly kiyada?', chips: ['Groceries', 'Electronics', 'Home items', 'Under Rs. 10000'] }
    if (chatLang === 'tanglish' || chatLang === 'ta') return { type: 'chat', text: 'Seri, unga shopping-na practical-a poduvom. Enna venum - groceries, electronics, fashion, illa home items? Budget evlo?', chips: ['Groceries', 'Electronics', 'Home items', 'Under Rs. 10000'] }
    return { type: 'chat', text: 'Sure. For your own shopping I would keep it practical. What are we buying first: groceries, electronics, fashion, or home items? Any budget?', chips: ['Groceries', 'Electronics', 'Home items', 'Under Rs. 10000'] }
  }
  if (chatLang === 'singlish' || chatLang === 'si') return { type: 'chat', text: slots.mood === 'sad' ? 'Ane, eka sensitive scene ekak. Over karanne nathuwa classy, simple gift ekak balamu. Eyata chocolates, flowers, teddy, perfume wage mokakda fit? Budget eka roughly kiyada?' : 'Hari, random gift ekak denna one na. Eyata fit wena style eka pick karamu - chocolates, flowers, teddy, perfume, cake wage mokakda? Budget eka roughly kiyada?', chips: ['Show chocolates', 'Flowers balamu', 'Under Rs. 5000', 'Help me choose'] }
  if (chatLang === 'tanglish' || chatLang === 'ta') return { type: 'chat', text: slots.mood === 'sad' ? 'Aiyo, sensitive situation. Over pannaama classy, simple gift paakalam. Chocolates, flowers, teddy, perfume-la edhu suit aagum? Budget evlo?' : 'Seri, random gift venam. Avanga style-ku fit aagura option pick pannalam - chocolates, flowers, teddy, perfume, cake? Budget evlo?', chips: ['Show chocolates', 'Show flowers', 'Under Rs. 5000', 'Help me choose'] }
  return { type: 'chat', text: slots.mood === 'sad' ? 'Aiyo, sensitive one. I would keep it classy and not overdo it. What style should we use: chocolates, flowers, teddy, perfume, or a note-led gift? Any budget?' : 'Good. I would not throw random products at this. What style fits them best: chocolates, flowers, teddy, perfume, cake, or something else? Any budget?', chips: ['Show chocolates', 'Show flowers', 'Under Rs. 5000', 'Help me choose'] }
}

function copy(slots: Slots, chatLang: ChatLang, total: number) {
  const budget = slots.budget ? ' within Rs. ' + slots.budget.toLocaleString() : ''
  if (slots.intent === 'self_shop') {
    if (chatLang === 'singlish' || chatLang === 'si') return 'Hari, self-shopping nam essentials first widihata yamu' + budget + '. Mama practical base tika pick kara. Estimated one-each base: Rs. ' + total.toLocaleString() + '.'
    if (chatLang === 'tanglish' || chatLang === 'ta') return 'Seri, self-shopping-na essentials first' + budget + '. Practical base items pick panninen. Estimated base: Rs. ' + total.toLocaleString() + '.'
    return 'For self-shopping, I would start with practical essentials' + budget + '. Estimated one-each base: Rs. ' + total.toLocaleString() + '.'
  }
  if (slots.category === 'chocolate') {
    if (chatLang === 'singlish' || chatLang === 'si') return 'Hari, chocolate nam proper gift widihata denna puluwan options tika balamu. Snacks/biscuits nemei - eyata denna lassana chocolate picks tika mewa.'
    if (chatLang === 'tanglish' || chatLang === 'ta') return 'Seri, chocolates-na proper gift-a kudukka suitable options paakalam. Snacks illa - gift feel irukkura picks dhaan.'
    return 'Good call. Chocolate should feel like a gift here, not random snacks, so I picked proper chocolate options.'
  }
  if (slots.intent === 'emotional_gift') return chatLang === 'singlish' || chatLang === 'si' ? 'Aiyo, eka hithata wadina scene ekak. Plan eka simple: classy gift ekak, short note ekak, puluwan nam oya hand-deliver karanna.' : 'Aiyo, that is sensitive. I would keep the move simple: a classy gift, a short note, and hand-deliver if you can.'
  return chatLang === 'singlish' || chatLang === 'si' ? 'Hari, eyata fit wena gift-style options tika mewa. Random dewal nemei - denna puluwan widihata balala pick kara.' : 'Here are gift-style options that fit the request, not random catalog items.'
}

function context(slots: Slots) {
  if (slots.intent === 'self_shop') return slots.category === 'groceries' ? 'Weekly essentials base' : 'Practical picks'
  if (slots.category === 'chocolate') return 'Chocolate gifts for her'
  if (slots.category === 'flowers') return 'Sincere flower picks'
  if (slots.category === 'note_card') return 'Note card add-ons'
  return 'Recommended picks'
}

function budgetRaiseAskPayload(chatLang: ChatLang): ChatPayload {
  if (chatLang === 'singlish' || chatLang === 'si') return { type: 'chat', text: 'Hari, budget eka wadi karamu. New budget eka kiyada? Rs. 10000, Rs. 15000 wage kiyannako.', chips: ['Rs. 10000', 'Rs. 15000', 'No budget limit'] }
  if (chatLang === 'tanglish' || chatLang === 'ta') return { type: 'chat', text: 'Seri, budget increase pannalam. New budget evlo? Rs. 10000, Rs. 15000 madhiri sollunga.', chips: ['Rs. 10000', 'Rs. 15000', 'No budget limit'] }
  return { type: 'chat', text: 'Sure, let us raise it. What new budget should I use? For example Rs. 10,000 or Rs. 15,000.', chips: ['Rs. 10000', 'Rs. 15000', 'No budget limit'] }
}

function budgetFailurePayload(slots: Slots, chatLang: ChatLang): ChatPayload {
  const budget = slots.budget ? 'Rs. ' + slots.budget.toLocaleString() : 'that budget'
  // If user already tried simpler options, suggest switching category entirely
  if (slots.simple) {
    if (chatLang === 'singlish' || chatLang === 'si') return { type: 'chat', text: 'Ane, ' + budget + ' athule mehema search kalath gift-quality ekak hambenne naha. Honest best move eka: budget eka poddak wadi karanna, nathnam flowers hari card ekak wage vena gift type ekakata yamu.', chips: ['Rs. 10000', 'Rs. 15000', 'Show flowers', 'No budget limit'] }
    if (chatLang === 'tanglish' || chatLang === 'ta') return { type: 'chat', text: 'Sorry, ' + budget + ' kulla search pannadhum gift-quality option kidaikkala. Best move: budget konjam increase pannunga, illa flowers/card side-ku maaralam.', chips: ['Rs. 10000', 'Rs. 15000', 'Show flowers', 'No budget limit'] }
    return { type: 'chat', text: 'I searched wider but still cannot find a gift-quality pick within ' + budget + '. My honest advice: raise the budget a bit, or switch to flowers or a card.', chips: ['Rs. 10000', 'Rs. 15000', 'Show flowers', 'No budget limit'] }
  }
  if (chatLang === 'singlish' || chatLang === 'si') {
    return {
      type: 'chat',
      text: budget + ' athule gift-quality options hambune naha. Budget eka poddak wadi karannada, cheaper options balannada, nathnam flowers/card wage wena ekak balannada?',
      chips: ['Rs. 10000', 'Rs. 15000', 'Simpler options', 'Show flowers'],
    }
  }
  if (chatLang === 'tanglish' || chatLang === 'ta') {
    return {
      type: 'chat',
      text: budget + ' kulla gift-quality options kidaikkala. Budget increase pannalama, cheaper options paakalama, illa flowers/card paakalama?',
      chips: ['Rs. 10000', 'Rs. 15000', 'Simpler options', 'Show flowers'],
    }
  }
  return {
    type: 'chat',
    text: 'I could not find proper gift-quality options within ' + budget + '. Want me to raise the budget, show cheaper alternatives, or switch to flowers or a card?',
    chips: ['Rs. 10000', 'Rs. 15000', 'Simpler options', 'Show flowers'],
  }
}

function chips(slots: Slots) {
  if (slots.intent === 'self_shop') return ['Keep under budget', 'Add snacks', 'Checkout now']
  if (slots.category === 'chocolate') return ['Add flowers', 'Add note card', 'Under Rs. 5000']
  if (slots.category === 'flowers') return ['Add note card', 'Help write the note', 'Checkout now']
  return ['Show chocolates', 'Add flowers', 'Under Rs. 5000']
}

export async function runAgenticShoppingPipeline(opts: {
  text: string
  chatLang: ChatLang
  mcp: KaprukaMCPClient
  emitStatus: StatusEmitter
  messages?: ChatTurn[]
}): Promise<ChatPayload | null> {
  const normalizedText = normalize(opts.text)

  // Handle "Raise budget" WITHOUT a number — ask for the new budget
  const wantsRaiseBudget = /\b(raise budget|increase budget|budget eka wadi|budget wadi|wadi karanna|budget increase|raise|wadi)\b/.test(normalizedText)
  if (wantsRaiseBudget && !parseBudget(normalizedText) && !/\b(no budget limit|no limit|budget limit na|budget ekak na|limit naha|budget illai)\b/.test(normalizedText)) {
    return budgetRaiseAskPayload(opts.chatLang)
  }

  const slots = classify(opts.text, opts.messages)

  // If user just gave a budget number (e.g., "Rs. 10000") after we asked for it,
  // and there's shopping context from history, force a search immediately
  const isPureBudgetResponse = /^\s*(?:rs\.?\s*)?\d{3,7}\s*$/i.test(normalizedText.replace(/,/g, ''))
  if (isPureBudgetResponse && slots.intent === 'unknown' && slots.budget) {
    // Reconstruct intent from conversation history
    const historySlots = classify(memory(opts.messages, 'user'), opts.messages)
    if (historySlots.intent !== 'unknown') {
      slots.intent = historySlots.intent
      slots.category = historySlots.category ?? slots.category
      slots.recipient = historySlots.recipient ?? slots.recipient
      slots.mood = historySlots.mood ?? slots.mood
      slots.budgetRaised = true
      slots.broad = false
    }
  }

  // "No budget limit" — force search with no budget constraint using history context
  if (slots.noBudgetLimit && slots.intent === 'unknown') {
    const historySlots = classify(memory(opts.messages, 'user'), opts.messages)
    if (historySlots.intent !== 'unknown') {
      slots.intent = historySlots.intent
      slots.category = historySlots.category ?? slots.category
      slots.recipient = historySlots.recipient ?? slots.recipient
      slots.mood = historySlots.mood ?? slots.mood
      slots.budget = undefined
      slots.broad = false
    }
  }

  // "Simpler options" — use history context + simple flag
  if (slots.simple && slots.intent === 'unknown') {
    const historySlots = classify(memory(opts.messages, 'user'), opts.messages)
    if (historySlots.intent !== 'unknown') {
      slots.intent = historySlots.intent
      slots.category = historySlots.category ?? slots.category
      slots.recipient = historySlots.recipient ?? slots.recipient
      slots.mood = historySlots.mood ?? slots.mood
      slots.broad = false
    }
  }

  if (slots.intent === 'unknown') return runAgenticShoppingShortcut(opts)
  if (slots.broad) return askPayload(slots, opts.chatLang)

  opts.emitStatus('agent_concierge', {
    label: slots.budgetRaised
      ? 'Searching with the new budget'
      : slots.simple
      ? 'Looking for simpler options'
      : slots.noBudgetLimit
      ? 'Searching without budget limit'
      : slots.intent === 'self_shop'
      ? 'Planning a practical basket'
      : 'Reading the occasion',
  })

  // Use the multi-strategy retry search
  const filtered = await searchWithRetry(opts.mcp, slots, opts.emitStatus)
  const products = toProducts(filtered, slots)

  if (!products.length && slots.budget) return budgetFailurePayload(slots, opts.chatLang)
  if (!products.length) return runAgenticShoppingShortcut(opts)

  const total = products.reduce((sum, p) => sum + p.price, 0)
  const overBudget = slots.budget && products.some((p) => p.price > slots.budget!)
  const rawText = overBudget
    ? copy(slots, opts.chatLang, total) + (opts.chatLang === 'singlish' || opts.chatLang === 'si'
        ? ' Budget eka poddak iwara karanna una, but mewa closest options.'
        : opts.chatLang === 'tanglish' || opts.chatLang === 'ta'
        ? ' Budget konjam cross aagidhu, but closest options idhu.'
        : ' These are the closest options, slightly above budget.')
    : copy(slots, opts.chatLang, total)

  return {
    type: 'product_trio',
    rawText,
    trio: { context: context(slots), products },
    chips: chips(slots),
  }
}

