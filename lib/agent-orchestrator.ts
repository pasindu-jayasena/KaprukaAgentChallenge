import type { ChatLang, ChatPayload } from '@/types'
import type { KaprukaMCPClient } from '@/lib/server/mcp-client'

type StatusEmitter = (name: string, args?: Record<string, unknown>) => void

/**
 * ═══ EXACT-MATCH FAST PATHS ═══
 *
 * These are the ONLY cases where we bypass the LLM:
 * - User says an obvious, unambiguous product category name
 * - The intent is 100% clear with no room for interpretation
 *
 * Everything else goes to the LLM — it's the brain, not regex.
 */

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

// ─── Minimal helpers (data operations, not intelligence) ───

function normalize(text: string) {
  return text.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
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

function parseBudget(text: string) {
  const normalized = normalize(text).replace(/,/g, '')
  const explicit = normalized.match(/(?:rs\.?|lkr|under|below|budget|yata|adu|less than|up to)\s*(\d{3,7})|\b(\d{3,7})\b\s*(?:rs\.?|lkr|budget|yata|under)/i)
  const explicitValue = Number(explicit?.[1] ?? explicit?.[2] ?? 0)
  if (Number.isFinite(explicitValue) && explicitValue > 0) return explicitValue
  const bareNumbers = [...normalized.matchAll(/\b(\d{3,7})\b/g)].map((m) => Number(m[1]))
  const likelyBudget = bareNumbers.find((n) => n >= 500 && n <= 500000)
  return likelyBudget && Number.isFinite(likelyBudget) ? likelyBudget : undefined
}

// ─── Exact-match fast path: only fires for unambiguous product requests ───

type ExactCategory = 'chocolate' | 'flowers' | 'cake' | 'perfume' | 'teddy' | 'groceries' | 'electronics'

interface ExactMatch {
  category: ExactCategory
  query: string
  budget?: number
}

/**
 * Only matches when the user message is an obvious, direct product request.
 * Examples that match: "show chocolates", "flowers under 5000", "I need a cake"
 * Examples that DON'T match: "my gf is angry", "what should I get", "meken hoda mokakda"
 */
function exactMatchFastPath(text: string): ExactMatch | null {
  const t = normalize(text)

  // Must have a clear product category mention
  let category: ExactCategory | null = null
  let query = ''

  if (/\b(chocolates?|choco|cadbury|ferrero|kandos|toblerone)\b/.test(t)) {
    category = 'chocolate'
    query = 'chocolate gift cadbury ferrero hamper'
  } else if (/\b(flowers?|roses?|bouquet)\b/.test(t)) {
    category = 'flowers'
    query = 'rose flowers bouquet'
  } else if (/\b(cakes?|birthday cake|gateau)\b/.test(t)) {
    category = 'cake'
    query = 'birthday cake'
  } else if (/\b(perfumes?|fragrance)\b/.test(t)) {
    category = 'perfume'
    query = 'perfume gift for her'
  } else if (/\b(teddy|soft toy|plush)\b/.test(t)) {
    category = 'teddy'
    query = 'teddy bear gift'
  } else if (/\b(grocer(?:y|ies)|rice|milk|dhal|dal|daily essentials?)\b/.test(t)) {
    category = 'groceries'
    query = 'rice milk groceries daily essentials'
  } else if (/\b(phone charger|charger|cable|electronics?|power bank|adapter|headset|earbuds)\b/.test(t)) {
    category = 'electronics'
    query = 'phone charger cable power bank adapter electronics'
  }

  if (!category) return null

  // Must also have a shopping verb or be a pure category mention (not a question about it)
  const hasShoppingIntent =
    /\b(show|find|search|browse|buy|order|need|want|looking|one|ekak|tikak|denna|oné|ganna|venum)\b/.test(t) ||
    t.split(/\s+/).length <= 3 // Pure category mention like "chocolates" or "flowers under 5000"

  // Reject if it's clearly a question/advice request
  const isQuestion =
    /\b(which|best|better|compare|difference|will she|would she|should i|kamathi weida|hoda mokakda|meken)\b/.test(t)

  // Reject cart actions ("add the Kandos one to my cart") — the LLM must
  // handle those so it can emit a real <ADD_TO_CART> tag instead of re-searching
  const isCartAction = /\b(add|cart|basket|danna|daanna|dapan|serthu|podu)\b/.test(t)

  if (!hasShoppingIntent || isQuestion || isCartAction) return null

  const budget = parseBudget(text)
  return { category, query, budget }
}

// ─── Search and format (pure data operations) ───

async function search(mcp: KaprukaMCPClient, q: string, budget: number | undefined, emit: StatusEmitter) {
  emit('kapruka_search_products', { q, max_price: budget, limit: 18 })
  const raw = await mcp.callTool('kapruka_search_products', { q, ...(budget ? { max_price: budget } : {}), limit: 18 })
  return extractJson(raw)?.results ?? []
}

function toProducts(results: SearchProduct[], budget?: number) {
  const seen = new Set<string>()
  return results
    .filter((p) => p.id && p.name && p.in_stock !== false)
    .filter((p) => !budget || priceOf(p.price) <= budget)
    .map((p, index) => ({
      id: String(p.id),
      name: String(p.name),
      price: priceOf(p.price),
      image: p.image_url ?? null,
      url: p.url ?? null,
      pick: index === 0,
      in_stock: true,
      description: String(p.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
    }))
    .filter((p) => {
      if (!p.price || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
    .slice(0, 12)
}

// ─── Main pipeline ───

export async function runAgenticShoppingPipeline(opts: {
  text: string
  chatLang: ChatLang
  mcp: KaprukaMCPClient
  emitStatus: StatusEmitter
  messages?: ChatTurn[]
}): Promise<ChatPayload | null> {
  // ─── FAST PATH: Only for exact, unambiguous product requests ───
  const exact = exactMatchFastPath(opts.text)

  if (exact) {
    opts.emitStatus('agent_concierge', { label: 'Finding the best options' })

    const results = await search(opts.mcp, exact.query, exact.budget, opts.emitStatus)
    const products = toProducts(results, exact.budget)

    if (!products.length && exact.budget) {
      // Try without budget constraint
      const noBudget = await search(opts.mcp, exact.query, undefined, opts.emitStatus)
      const closestProducts = toProducts(noBudget).filter((p) => p.price <= (exact.budget ?? Infinity) * 1.3)
      if (closestProducts.length > 0) {
        return {
          type: 'product_trio',
          rawText: 'These are the closest options I found:',
          trio: { context: `${exact.category} picks`, products: closestProducts },
        }
      }
      // Nothing found even without budget — let LLM handle the conversation
      return null
    }

    if (!products.length) {
      // Let LLM handle when no products found — it can suggest alternatives naturally
      return null
    }

    return {
      type: 'product_trio',
      rawText: undefined, // Let the LLM's system prompt handle the conversational text
      trio: { context: `${exact.category} picks`, products },
    }
  }

  // ─── Everything else: let the LLM decide ───
  // The LLM has the full conversation context, user profile, cart state,
  // and can use tools (kapruka_search_products, etc.) on its own.
  // It should think like a human sales agent — read the situation,
  // decide what to do, and respond naturally.

  return null
}
