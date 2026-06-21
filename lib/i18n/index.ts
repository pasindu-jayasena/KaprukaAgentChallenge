import en from './en'
import si from './si'
import ta from './ta'
import type { UiLang } from '@/types'
import type { Messages } from './en'
export type { Messages } from './en'

const catalogs = { en, si, ta } as const

export function getMessages(lang: UiLang): Messages {
  return catalogs[lang]
}

export function t(lang: UiLang, path: string): string {
  const parts = path.split('.')
  let cur: unknown = catalogs[lang]
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return path
    }
  }
  return typeof cur === 'string' ? cur : path
}
