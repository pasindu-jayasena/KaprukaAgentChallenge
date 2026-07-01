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
  broad: boolean
}

function normalize(text: string) {
  return text.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
}

function memory(messages?: ChatTurn[]) {
  return (messages ?? [])
    .filter((m) => !m.content.includes('CHECKOUT_DETAILS:'))
    .slice(-8)
    .map((m) => m.content)
    .join(' ')
}

function parseBudget(text: string) {
  const match = normalize(text).replace(/,/g, '').match(/(?:rs\.?|lkr|under|below|budget|yata|adu|less than|up to)\s*(\d{3,7})|\b(\d{3,7})\b\s*(?:rs\.?|lkr|budget|yata|under)/i)
  const value = Number(match?.[1] ?? match?.[2] ?? 0)
  return Number.isFinite(value) && value > 0 ? value : undefined
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
  const all = normalize(text + ' ' + memory(messages))
  const category = categoryOf(now) ?? categoryOf(all)
  const recipient = recipientOf(all)
  const budget = parseBudget(now) ?? parseBudget(all)
  const emotional = /\b(broke up|breakup|sorry|apology|forgive|sad|upset|heartbroken|duken|duka|tharaha|yalu karaganna|yalukaraganna)\b/.test(all)
  const gift = /\b(gift|send|surprise|girlfriend|wife|birthday|anniversary|eyata|kellawa|recipient|denna)\b/.test(all)
  const self = /\b(for myself|self shopping|weekly|grocer(?:y|ies)|daily essentials?|rice|milk|phone charger|charger|electronics?|home item|room item|mata ganna|mage gedarata)\b/.test(all)
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
    broad: (intent === 'gift_shop' || intent === 'emotional_gift') && (!category || category === 'gift'),
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
  if (slots.category === 'chocolate') return 'chocolate gift for her cadbury ferrero hamper'
  if (slots.category === 'flowers') return 'rose flowers bouquet'
  if (slots.category === 'note_card') return 'greeting card note card apology card'
  if (slots.category === 'cake') return 'birthday cake'
  if (slots.category === 'perfume') return 'perfume gift for her'
  if (slots.category === 'teddy') return 'teddy bear gift'
  return 'gift for her chocolate flowers teddy perfume'
}

function backupQuery(slots: Slots) {
  if (slots.category === 'chocolate') return 'chocolate hamper bouquet gift box'
  if (slots.category === 'flowers') return 'flowers rose bouquet'
  if (slots.category === 'groceries') return 'groceries essentials rice dhal milk'
  if (slots.category === 'electronics') return 'charger adapter cable power bank'
  return 'kapruka gift hamper'
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
  const slots = classify(opts.text, opts.messages)
  if (slots.intent === 'unknown') return runAgenticShoppingShortcut(opts)
  if (slots.broad) return askPayload(slots, opts.chatLang)

  opts.emitStatus('agent_concierge', { label: slots.intent === 'self_shop' ? 'Planning a practical basket' : 'Reading the occasion' })
  const first = await search(opts.mcp, query(slots), slots.budget, opts.emitStatus)
  let filtered = first.filter((p) => matches(p, slots))
  if (filtered.length < 2) {
    const backup = await search(opts.mcp, backupQuery(slots), slots.budget, opts.emitStatus)
    filtered = [...filtered, ...backup.filter((p) => matches(p, slots))]
  }
  const products = toProducts(filtered, slots)
  if (!products.length) return runAgenticShoppingShortcut(opts)
  const total = products.reduce((sum, p) => sum + p.price, 0)
  return {
    type: 'product_trio',
    rawText: copy(slots, opts.chatLang, total),
    trio: { context: context(slots), products },
    chips: chips(slots),
  }
}