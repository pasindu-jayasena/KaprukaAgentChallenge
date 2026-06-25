import type { ChatLang, ChatPayload, Product } from '@/types'
import type { KaprukaMCPClient } from '@/lib/server/mcp-client'

type StatusEmitter = (name: string, args?: Record<string, unknown>) => void

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

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasSinhala(text: string) {
  return Array.from(text).some((ch) => {
    const code = ch.charCodeAt(0)
    return code >= 0x0d80 && code <= 0x0dff
  })
}

function hasCodes(text: string, ...codes: number[]) {
  return codes.every((code) => text.includes(String.fromCharCode(code)))
}

function parseBudget(text: string): number | undefined {
  const normalized = normalize(text).replace(/,/g, '')
  const match = normalized.match(/(?:rs\.?|lkr|under|below|budget|yata|adu|kulla|aduwen)\s*(\d{3,6})/i)
  if (!match) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : undefined
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

function priceAmount(price: SearchProduct['price']) {
  if (typeof price === 'number') return price
  if (price && typeof price === 'object') return Number(price.amount ?? 0)
  return 0
}

function estimateTotal(products: Product[]) {
  return products.reduce((sum, product) => sum + (product.price || 0), 0)
}

function toProducts(results: SearchProduct[], mode: 'flowers' | 'basket' | 'note'): Product[] {
  const seen = new Set<string>()
  return results
    .filter((p) => p.id && p.name && p.in_stock !== false)
    .map((p, index) => {
      const id = String(p.id)
      const price = priceAmount(p.price)
      const name = String(p.name)
      const summary = String(p.summary ?? '').replace(/\s+/g, ' ').trim()
      const product: Product = {
        id,
        name,
        price,
        image: p.image_url ?? null,
        url: p.url ?? null,
        pick: index === 0,
        in_stock: true,
        reason:
          mode === 'flowers'
            ? index === 0
              ? 'Best balance of sincere and not too dramatic.'
              : 'Good emotional option without making it feel forced.'
            : mode === 'note'
            ? index === 0
              ? 'Add this so the gesture has words, not just flowers.'
              : 'Simple add-on that makes the message feel intentional.'
            : index === 0
            ? 'Start the basket with this practical essential.'
            : 'Useful add-on for an everyday order.',
        description: summary ? summary.slice(0, 140) : undefined,
      }
      return product
    })
    .filter((p) => {
      if (seen.has(p.id) || !p.price) return false
      seen.add(p.id)
      return true
    })
    .slice(0, 6)
}

function flowerCopy(chatLang: ChatLang) {
  if (chatLang === 'singlish' || chatLang === 'si') {
    return 'Aiyo, eka dukai. Plan eka simple: roses tika, short note ekak, puluwan nam oya hand-deliver karanna - courier ekata wada eka hithata wadina chance eka wediy. Me tika balamuda?'
  }
  if (chatLang === 'tanglish') {
    return 'Aiyo, adhu kashtam. Plan simple: roses, short note, mudinja neenga hand-deliver pannunga - courier vida adhu romba sincere-a feel aagum. Indha picks paakalama?'
  }
  return "Aiyo, that hurts. Here's the plan: keep it simple with roses, add a short note, and if you can, hand-deliver it - that lands warmer than a courier. I picked a few that feel sincere without overdoing it."
}

function basketCopy(chatLang: ChatLang, budget?: number) {
  const budgetText = budget ? ' within Rs. ' + budget.toLocaleString() : ''
  if (chatLang === 'singlish' || chatLang === 'si') {
    return 'Hari, self-shopping nam mama practical widihata balannam. Weekly basket ekata essentials first, snacks/extras passe' + budgetText + '. Me tika base ekata hondai - family size eka kiyuwoth mama thawa tight karannam.'
  }
  if (chatLang === 'tanglish') {
    return 'Seri, self-shopping-na practical-a poduvom. Weekly basket-ku essentials first, snacks/extras apram' + budgetText + '. Idhu good base - family size sonna naan tighter-a pick pannuren.'
  }
  return 'For self-shopping, I would build the basket practically: essentials first, then snacks or extras only if the budget allows' + budgetText + '. I picked a useful base; tell me family size and I will tighten it.'
}

function noteWriterCopy(chatLang: ChatLang) {
  if (chatLang === 'singlish' || chatLang === 'si') {
    return 'Meka soft widihata liyamu: "I know things are not okay right now. I am sorry for hurting you. No pressure to reply - I just wanted you to know I still care." Short, calm, pressure nathi note ekak thama better.'
  }
  if (chatLang === 'tanglish') {
    return 'Soft-a podalam: "I know things are not okay right now. I am sorry for hurting you. No pressure to reply - I just wanted you to know I still care." Short and calm note dhaan better.'
  }
  return 'I would keep the note short and pressure-free: "I know things are not okay right now. I am sorry for hurting you. No pressure to reply - I just wanted you to know I still care." That feels warmer than a long explanation.'
}

function isNoteCardRequest(text: string) {
  const t = normalize(text)
  return /\b(add|show|find|need|want)\b.*\b(note card|card|greeting card|sorry card|apology card)\b/.test(t) || /\b(note card|greeting card|sorry card|apology card)\b.*\b(add|show|find|need|want)\b/.test(t)
}

function isNoteWritingRequest(text: string) {
  const t = normalize(text)
  return /\b(help write|write|draft|message|note eka|note|caption)\b/.test(t) && /\b(note|sorry|apology|flowers?|girlfriend|wife|message|card)\b/.test(t)
}

function isSnackRequest(text: string) {
  const t = normalize(text)
  return /\b(snacks?|biscuits?|chocolate|tea time|add more groceries)\b/.test(t)
}

function isBudgetTightenRequest(text: string) {
  const t = normalize(text)
  return /\b(keep under budget|under budget|within budget|tighten|family size|for \d+ people|\d+ people)\b/.test(t)
}

function isEmotionalFlowerRequest(text: string) {
  const raw = text.toLowerCase().normalize('NFC')
  const t = normalize(text)
  const sinhalaText = hasSinhala(raw)
  const sinhalaFlower = sinhalaText && (/මල්|රෝස|මලක්/.test(raw) || hasCodes(raw, 0x0db8, 0x0dbd))
  const sinhalaEmotion =
    sinhalaText &&
    (/දුක|සමාව|තරහ|කණගාටු|අමනාප|බිඳුන/.test(raw) ||
      hasCodes(raw, 0x0daf, 0x0dd4, 0x0d9a) ||
      hasCodes(raw, 0x0dc3, 0x0db8, 0x0dcf))
  const sinhalaSend = sinhalaText && (/යවන්න|දෙන්න|ඕන|ඔන|බලන්න/.test(raw) || hasCodes(raw, 0x0dba, 0x0dc0, 0x0db1))
  return (
    (/\b(broke up|breakup|girlfriend|boyfriend|wife|husband|sorry|apology|fight|argued|angry|sad|upset|duken|duka|tharaha|kopa|pirinju|kashtam)\b/.test(t) &&
      /\b(flowers?|roses?|mal|gift|send|denna|anuppu)\b/.test(t)) ||
    (sinhalaFlower && sinhalaEmotion && (sinhalaSend || /මල්|රෝස/.test(raw)))
  )
}
function isEverydayBasketRequest(text: string) {
  const t = normalize(text)
  const sinhalaSelfShop =
    hasSinhala(t) && (hasCodes(t, 0x0d9c, 0x0db1) || hasCodes(t, 0x0d9c, 0x0dd9, 0x0daf, 0x0dbb))
  return (
    (/\b(weekly|week|grocer(?:y|ies)|daily essentials?|rice|milk|snacks?|gedarata|mata ganna|self shopping|shop for myself)\b/.test(t) ||
      sinhalaSelfShop) &&
    !/\b(birthday|anniversary|apology|girlfriend|wife|gift for|send to)\b/.test(t)
  )
}

async function searchProducts(mcp: KaprukaMCPClient, query: string, maxPrice: number | undefined, emit: StatusEmitter) {
  emit('kapruka_search_products', { q: query, max_price: maxPrice, limit: 8 })
  const raw = await mcp.callTool('kapruka_search_products', {
    q: query,
    ...(maxPrice ? { max_price: maxPrice } : {}),
    limit: 8,
  })
  return extractJson(raw)?.results ?? []
}

export async function runAgenticShoppingShortcut(opts: {
  text: string
  chatLang: ChatLang
  mcp: KaprukaMCPClient
  emitStatus: StatusEmitter
}): Promise<ChatPayload | null> {
  const { text, chatLang, mcp, emitStatus } = opts

  if (isNoteCardRequest(text)) {
    emitStatus('agent_concierge', { label: 'Adding words to the gesture' })
    const results = await searchProducts(mcp, 'apology greeting card', parseBudget(text), emitStatus)
    const products = toProducts(results, 'note')
    if (!products.length) {
      return { type: 'chat', text: noteWriterCopy(chatLang), chips: ['Show flower picks', 'Make it shorter'] }
    }
    return {
      type: 'product_trio',
      rawText:
        'Good call. A small note card makes the flowers feel intentional, not random. I would keep the wording short and calm, then add one of these.',
      trio: { context: 'Note card add-ons', products },
      chips: ['Help write the note', 'Show flower picks', 'Checkout now'],
    }
  }

  if (isNoteWritingRequest(text)) {
    return {
      type: 'chat',
      text: noteWriterCopy(chatLang),
      chips: ['Add note card', 'Make it shorter', 'Show flower picks'],
    }
  }

  if (isSnackRequest(text)) {
    const budget = parseBudget(text)
    emitStatus('agent_concierge', { label: 'Adding useful extras' })
    const results = await searchProducts(mcp, 'snacks biscuits groceries', budget, emitStatus)
    const products = toProducts(results, 'basket')
    if (!products.length) return null
    return {
      type: 'product_trio',
      rawText: 'Good add. I would keep snacks as the flexible part of the basket - essentials first, then these if the budget still has room.',
      trio: { context: 'Snack add-ons', products },
      chips: ['Keep under budget', 'Add drinks too', 'Checkout now'],
    }
  }

  if (isBudgetTightenRequest(text)) {
    return {
      type: 'chat',
      text: 'Shape. To protect the budget, keep one milk item, one rice/staple item, and only one snack. Add the essentials first; if the cart total is still under budget, then add treats. Tell me the family size and max budget, I will tighten the basket.',
      chips: ['Family size 2', 'Family size 4', 'Under Rs. 5000'],
    }
  }

  if (isEmotionalFlowerRequest(text)) {
    emitStatus('agent_concierge', { label: 'Reading the emotion' })
    emitStatus('agent_logistics', { label: 'Choosing the softer move' })
    const results = await searchProducts(mcp, 'rose flowers', parseBudget(text), emitStatus)
    const products = toProducts(results, 'flowers')
    if (!products.length) return null
    return {
      type: 'product_trio',
      rawText: flowerCopy(chatLang),
      trio: { context: 'Sincere flower picks', products },
      chips: ['Add note card', 'Show simpler flowers', 'Help write the note'],
    }
  }

  if (isEverydayBasketRequest(text)) {
    const budget = parseBudget(text)
    emitStatus('agent_concierge', { label: 'Building a practical basket' })
    emitStatus('agent_logistics', { label: 'Protecting the budget' })
    const results = await searchProducts(mcp, 'rice milk groceries', budget, emitStatus)
    const products = toProducts(results, 'basket')
    if (!products.length) return null
    return {
      type: 'product_trio',
      rawText:
        basketCopy(chatLang, budget) +
        ' Estimated one-each base: Rs. ' +
        estimateTotal(products).toLocaleString() +
        '.',
      trio: { context: 'Weekly essentials base', products },
      chips: ['Add more groceries', 'Need snacks too', 'Keep under budget'],
    }
  }

  return null
}
