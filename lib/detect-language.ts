import type { ChatLang } from '@/types'

const SINHALA_RE = /[\u0D80-\u0DFF]/
const TAMIL_RE = /[\u0B80-\u0BFF]/

const SINGLISH_MARKERS = [
  'mokada',
  'monawada',
  'mona',
  'kohomada',
  'komada',
  'kawda',
  'kawurata',
  'kaatada',
  'kata',
  'katada',
  'ganna',
  'denna',
  'karanna',
  'balanna',
  'kiyanna',
  'ona',
  'one',
  'oneda',
  'ekak',
  'eka',
  'ekata',
  'hari',
  'hondai',
  'hodai',
  'lassana',
  'mama',
  'mata',
  'oyata',
  'oya',
  'eyata',
  'eya',
  'amma',
  'thaththa',
  'malli',
  'nangi',
  'aiya',
  'akka',
  'kella',
  'kellek',
  'kollek',
  'yalu',
  'duken',
  'duka',
  'inne',
  'thiyenne',
  'tiyenne',
  'tiyenawa',
  'therenawa',
  'therenawada',
  'therenawad',
  'tharaha',
  'kopa',
  'kamathi',
  'vayasa',
  'kiyada',
  'kiyd',
  'puluwanda',
  'puluvanda',
  'nadda',
  'neda',
  'nathnam',
  'wage',
  'tikak',
  'loku',
  'poddi',
  'istuti',
  'bohoma',
  'dan',
  'ada',
  'heta',
  'gift eka',
  'gift ekak',
  'cake ekak',
  'flower ekak',
  'bn',
]

const TANGLISH_MARKERS = [
  'enna',
  'enna venum',
  'venum',
  'venuma',
  'vendum',
  'thevai',
  'irukka',
  'iruku',
  'illa',
  'illai',
  'sollu',
  'sollunga',
  'paaru',
  'paarunga',
  'pathu',
  'nalla',
  'romba',
  'konjam',
  'ippo',
  'ippadi',
  'eppadi',
  'evlo',
  'evvalavu',
  'anga',
  'inga',
  'avalukku',
  'avanukku',
  'amma ku',
  'appa ku',
  'birthday ku',
  'gift ku',
  'sapadu',
  'saapadu',
  'pannunga',
  'panna',
  'podunga',
  'seri',
  'nandri',
]

function markerScore(text: string, markers: string[]) {
  const normalized = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `
  return markers.reduce((score, marker) => {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return score + (new RegExp(`\\b${escaped}\\b`, 'i').test(normalized) ? 1 : 0)
  }, 0)
}

export function detectChatLanguage(text: string): ChatLang {
  const t = text.trim()
  if (!t) return 'en'

  if (SINHALA_RE.test(t)) return 'si'
  if (TAMIL_RE.test(t)) return 'ta'

  const singlishScore = markerScore(t, SINGLISH_MARKERS)
  const tanglishScore = markerScore(t, TANGLISH_MARKERS)

  if (tanglishScore > singlishScore) return 'tanglish'
  if (singlishScore > 0) return 'singlish'

  return 'en'
}
