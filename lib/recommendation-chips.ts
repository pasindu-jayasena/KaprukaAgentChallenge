import type { UiLang } from '@/types'

/**
 * ═══ RECOMMENDATION CHIPS ═══
 *
 * The LLM generates contextual chips via <CHIPS> tags in its response.
 * These fallbacks are ONLY used when the LLM doesn't generate chips.
 *
 * Strategy: keep a few smart defaults, but trust the LLM for context-aware chips.
 */

const AFTER_ADD: Record<UiLang, string[]> = {
  en: ['Checkout now', 'Add more items', 'Keep browsing'],
  si: ['Checkout now', 'Wena deyak add karanna', 'Keep browsing'],
  ta: ['Checkout now', 'Vera edhavadhu add pannunga', 'Keep browsing'],
}

const AFTER_CHECKOUT: Record<UiLang, string[]> = {
  en: ['Shop again', 'Track my order', 'Send another gift'],
  si: ['Ayeth shop karamu', 'Track my order', 'Another gift'],
  ta: ['Innum shop pannalam', 'Track my order', 'Another gift'],
}

export function getAfterAddToCartChips(uiLang: UiLang): string[] {
  return AFTER_ADD[uiLang]
}

export function getAfterCheckoutChips(uiLang: UiLang): string[] {
  return AFTER_CHECKOUT[uiLang]
}

/**
 * Lightweight fallback: only triggers for very obvious assistant patterns
 * when the LLM forgot to include <CHIPS>.
 *
 * The LLM's system prompt now explicitly instructs it to ALWAYS generate
 * contextual chips, so this should rarely fire.
 */
export function inferChipsFromAssistantText(text: string, uiLang: UiLang): string[] | null {
  // Checkout-related
  if (/checkout|ready to (?:pay|order)|delivery details|confirm/i.test(text)) {
    return ['Checkout now', 'Add more items', 'Change details']
  }

  // After showing products — gentle nudge
  if (/PRODUCT_TRIO|here are|take a look|picked these/i.test(text)) {
    return ['This one looks good', 'Show more options', 'Checkout now']
  }

  // No fallback — the LLM should have included chips
  return null
}

export function mergeChips(primary: string[] | undefined, fallback: string[] | null): string[] {
  const base = primary?.length ? primary : fallback ?? []
  return [...new Set(base)].slice(0, 5)
}

export function addToCartFollowUp(productName: string, uiLang: UiLang): string {
  if (uiLang === 'si') {
    return `${productName} cart eke. Wena deyak add karannada, nathnam checkout karannada?`
  }
  if (uiLang === 'ta') {
    return `${productName} cart-la add panniten. Vera edhavadhu add pannalama, illa checkout pannalama?`
  }
  return `Added ${productName} to your cart. Want to add anything else or checkout now?`
}

// Keep backward compatibility — deprecated, but some files may still import
export function getOccasionChips(uiLang: UiLang): string[] {
  return ['Birthday', 'Anniversary', 'Wedding', 'Thank you', 'Party']
}
