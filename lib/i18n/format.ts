/** Interpolate `{name}` placeholders in translated strings. */
export function formatMessage(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key]
    return value != null && value !== '' ? String(value) : `{${key}}`
  })
}

/** Format LKR amounts consistently across UI languages. */
export function formatCurrency(
  amount: number,
  lang: 'en' | 'si' | 'ta' = 'en'
): string {
  const formatted = amount.toLocaleString('en-LK')
  if (lang === 'si') return `රු. ${formatted}`
  if (lang === 'ta') return `ரூ. ${formatted}`
  return `Rs. ${formatted}`
}

/** Locale-aware short date for receipts and plan cards. */
export function formatLocaleDate(
  date: string,
  lang: 'en' | 'si' | 'ta' = 'en'
): string {
  const d = new Date(date.includes('T') ? date : `${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  const locale = lang === 'si' ? 'si-LK' : lang === 'ta' ? 'ta-LK' : 'en-GB'
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
