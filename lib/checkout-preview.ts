import type { CartItem, CheckoutDetailsInput } from '@/types'
import { KaprukaMCPClient } from '@/lib/server/mcp-client'

export interface CheckoutPreviewResult {
  subtotal: number
  deliveryFee: number | null
  total: number | null
  deliveryAvailable: boolean
  deliveryNote?: string
}

function parseDeliveryCheck(raw: string): { rate: number | null; available: boolean; reason?: string } {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const available = j.available !== false
    const rate =
      typeof j.rate === 'number'
        ? j.rate
        : typeof j.delivery_fee === 'number'
          ? j.delivery_fee
          : null
    return { rate, available, reason: j.reason ? String(j.reason) : undefined }
  } catch {
    const rateMatch = raw.match(/(?:Delivery fee|rate)[:\s]+(?:LKR|Rs\.?)\s*([\d,]+)/i)
    const available = !/not available|unavailable/i.test(raw)
    return {
      rate: rateMatch ? parseInt(rateMatch[1].replace(/,/g, ''), 10) : null,
      available,
    }
  }
}

export async function getCheckoutPreview(
  cart: CartItem[],
  details: CheckoutDetailsInput
): Promise<CheckoutPreviewResult> {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const mcp = new KaprukaMCPClient()

  let city = details.recipient.city.trim()
  let deliveryFee: number | null = null
  let deliveryAvailable = true
  let deliveryNote: string | undefined

  try {
    const citiesRaw = await mcp.callTool('kapruka_list_delivery_cities', {
      query: city,
      limit: 5,
    })
    try {
      const cities = JSON.parse(citiesRaw) as {
        cities?: Array<{ name?: string; city?: string }>
        results?: Array<{ name?: string }>
      }
      const list = cities.cities ?? cities.results ?? (Array.isArray(cities) ? cities : [])
      const match = (list as Array<{ name?: string; city?: string }>).find((c) =>
        (c.name ?? c.city ?? '').toLowerCase().includes(city.toLowerCase())
      )
      if (match?.name) city = match.name
      else if (match?.city) city = match.city
    } catch {
      /* use raw city */
    }

    // Check delivery for every distinct product in the cart — a city/date
    // combo can be fine for one item and unavailable for another (e.g.
    // perishables, oversized items, or items with their own cutoff dates).
    const uniqueProductIds = [...new Set(cart.map((i) => i.id).filter(Boolean))]
    const checks = await Promise.all(
      (uniqueProductIds.length ? uniqueProductIds : [undefined]).map(async (productId) => {
        const raw = await mcp.callTool('kapruka_check_delivery', {
          city,
          delivery_date: details.recipient.date,
          product_id: productId,
        })
        return { productId, ...parseDeliveryCheck(raw) }
      })
    )

    const firstRate = checks.find((c) => c.rate != null)?.rate ?? null
    deliveryFee = firstRate
    const unavailable = checks.filter((c) => !c.available)
    deliveryAvailable = unavailable.length === 0
    if (unavailable.length > 0) {
      const itemName =
        unavailable.length === 1
          ? cart.find((i) => i.id === unavailable[0].productId)?.name
          : undefined
      const reason = unavailable[0].reason
      deliveryNote =
        reason ??
        (itemName
          ? `${itemName} can't be delivered to ${city} on that date.`
          : 'Delivery may not be available for this city/date.')
    }
  } catch {
    deliveryNote = 'Final delivery fee will be confirmed when you place the order.'
  }

  const total = deliveryFee != null ? subtotal + deliveryFee : null

  return {
    subtotal,
    deliveryFee,
    total,
    deliveryAvailable,
    deliveryNote,
  }
}
