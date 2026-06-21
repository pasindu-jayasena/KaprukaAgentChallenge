import type { ChatLang } from '@/types'

const SINHALA_RE = /[\u0D80-\u0DFF]/
const TAMIL_RE = /[\u0B80-\u0BFF]/

const SINGLISH_MARKERS =
  /\b(mokada|ganna|ona|one|eka|ekak|ekata|hari|machan|aiyo|lassana|yata|denna|karanna|mata|thaththa|amma|gift eka|gift ekak|cake ekak|kohomada|kellek|kellage|kawurata|puluvanda|puluwanda|bn|hondai|istuti|kamathi|vayasa)\b/i

const TANGLISH_MARKERS =
  /\b(enna|venum|pathu|sollu|nalla|birthday ku|gift ona|ippadi|romba|paaru)\b/i

export function detectChatLanguage(text: string): ChatLang {
  const t = text.trim()
  if (!t) return 'en'

  if (SINHALA_RE.test(t)) return 'si'
  if (TAMIL_RE.test(t)) return 'ta'

  const hasSinglish = SINGLISH_MARKERS.test(t)
  const hasTanglish = TANGLISH_MARKERS.test(t)

  if (hasTanglish && !hasSinglish) return 'tanglish'
  if (hasSinglish) return 'singlish'

  return 'en'
}
