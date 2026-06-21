/** Normalize recipient names for fuzzy matching */
export function normalizeRecipientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function recipientNamesMatch(a: string, b: string): boolean {
  const na = normalizeRecipientName(a)
  const nb = normalizeRecipientName(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}
