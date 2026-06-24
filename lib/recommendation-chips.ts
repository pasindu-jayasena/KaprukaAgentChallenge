import type { UiLang } from '@/types'

const OCCASION: Record<UiLang, string[]> = {
  en: ['Birthday', 'Anniversary', 'Wedding', 'Get well', 'Thank you', 'Party'],
  si: ['Birthday', 'Anniversary', 'Wedding', 'Get well', 'Thank you', 'Party'],
  ta: ['Birthday', 'Anniversary', 'Wedding', 'Get well', 'Thank you', 'Party'],
}

const AFTER_ADD: Record<UiLang, string[]> = {
  en: ['Checkout now', 'Add chocolates', 'Add flowers', 'Add a cake', 'Keep browsing'],
  si: ['Checkout now', 'Chocolates add karanna', 'Flowers add karanna', 'Cake ekak', 'Keep browsing'],
  ta: ['Checkout now', 'Chocolates add pannunga', 'Flowers add pannunga', 'Cake venum', 'Keep browsing'],
}

const AFTER_CHECKOUT: Record<UiLang, string[]> = {
  en: ['Shop again', 'Track my order', 'Weekly groceries', 'Send another gift'],
  si: ['Ayeth shop karamu', 'Track my order', 'Groceries', 'Another gift'],
  ta: ['Innum shop pannalam', 'Track my order', 'Groceries', 'Another gift'],
}

const BUDGET: Record<UiLang, string[]> = {
  en: ['Under Rs. 5000', 'Rs. 5000-10000', 'Rs. 10000-20000', 'No budget limit'],
  si: ['Under Rs. 5000', 'Rs. 5000-10000', 'Rs. 10000-20000', 'Budget naha'],
  ta: ['Under Rs. 5000', 'Rs. 5000-10000', 'Rs. 10000-20000', 'Budget illa'],
}

const RECIPIENT: Record<UiLang, string[]> = {
  en: ['For my wife', 'For my husband', 'For my mother', 'For a friend', 'For my father'],
  si: ['For my wife', 'For my husband', 'For my mother', 'For a friend', 'For my father'],
  ta: ['For my wife', 'For my husband', 'For my mother', 'For a friend', 'For my father'],
}

const OCCASION_PATTERNS =
  /occasion|what(?:'s| is) (?:the|this) (?:for|about)|celebrating|what are we celebrating|why are you (?:buying|sending)|gift for what|what event/i

const BUDGET_PATTERNS = /budget|how much|price range|spend|afford|under rs|below rs/i

const RECIPIENT_PATTERNS = /who(?:'s| is) (?:this|it) for|who are you (?:buying|sending)|for whom|recipient/i

export function getOccasionChips(uiLang: UiLang): string[] {
  return OCCASION[uiLang]
}

export function getAfterAddToCartChips(uiLang: UiLang): string[] {
  return AFTER_ADD[uiLang]
}

export function getAfterCheckoutChips(uiLang: UiLang): string[] {
  return AFTER_CHECKOUT[uiLang]
}

/** Infer helpful quick-reply chips when the model omits <CHIPS>. */
export function inferChipsFromAssistantText(text: string, uiLang: UiLang): string[] | null {
  if (OCCASION_PATTERNS.test(text)) return getOccasionChips(uiLang)
  if (BUDGET_PATTERNS.test(text)) return BUDGET[uiLang]
  if (RECIPIENT_PATTERNS.test(text)) return RECIPIENT[uiLang]
  if (/checkout|ready to (?:pay|order)|cart icon|delivery details|address|recipient/i.test(text)) {
    return ['Checkout now', 'Add more items', 'Open cart']
  }
  if (/rephrase|more detail|tell me more|what (?:kind|type)/i.test(text)) {
    return getOccasionChips(uiLang).slice(0, 4)
  }
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
