import { convertSinglishToSinhala } from '@siyabasa/singlish'

export interface SinglishDirectReply {
  text: string
  chips?: string[]
}

const WORD_FIXES: Array<[RegExp, string]> = [
  [/\biyata\b/g, 'oyata'],
  [/\biata\b/g, 'oyata'],
  [/\boyt\b/g, 'oyata'],
  [/\bkohomd\b/g, 'kohomada'],
  [/\bkomada\b/g, 'kohomada'],
  [/\bthiyenne\b/g, 'tiyenne'],
  [/\bthiyennee\b/g, 'tiyenne'],
  [/\bthiyenawada\b/g, 'tiyenawada'],
  [/\btherenawad\b/g, 'therenawada'],
  [/\btherenavada\b/g, 'therenawada'],
  [/\bterenawada\b/g, 'therenawada'],
  [/\bduken\b/g, 'duken'],
  [/\bdukai\b/g, 'duka'],
]

function normalize(text: string) {
  let value = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const [pattern, replacement] of WORD_FIXES) {
    value = value.replace(pattern, replacement)
  }
  return value
}

function transliterate(text: string) {
  try {
    return convertSinglishToSinhala(text).normalize('NFC')
  } catch {
    return ''
  }
}

function isShort(text: string, maxWords = 8) {
  return text.split(/\s+/).filter(Boolean).length <= maxWords
}

function hasShoppingSearchIntent(text: string) {
  return /\b(show|find|search|browse|buy|order|checkout|cake|flower|gift|chocolate|hamper|teddy|watch|jewellery|perfume|under|budget)\b/i.test(
    text
  )
}

export function getSinglishDirectReply(input: string): SinglishDirectReply | null {
  const text = normalize(input)
  const sinhala = transliterate(text)
  if (!text) return null

  const wantsEnglish = /\b(english|ingrisi|ingreesi)\s+(walin|valin|with|in)\b/.test(text)
  if (wantsEnglish || /ඉන්ග්ලිශ් වලින් කියන්න|එන්ග්ලිශ් වලින් කියන්න/.test(sinhala)) {
    return {
      text:
        "Sure, I can reply in English. Tell me what happened, and I'll listen first. If you want to shop after that, I can help then.",
      chips: ['Tell you', 'Help me pick a gift', 'Later'],
    }
  }

  const asksHowAreYou =
    isShort(text) &&
    (/\b(kohomada|oyata kohomada|kohomada oyata|kohomada oyage)\b/.test(text) ||
      /කොහොම/.test(sinhala))

  if (asksHowAreYou) {
    return {
      text:
        'Mama hodin, thank you! Oyata kohomada? Gift ekak hari cake ekak hari hoyanna help oneda?',
      chips: ['Gift ekak', 'Cake ekak', 'Flowers', 'Just browsing'],
    }
  }

  const asksCatalog =
    (/\b(monawada|mona wada|mokakda)\b/.test(text) || /මොනව/.test(sinhala)) &&
    (/\b(tiyenne|tiyenawada|available|have)\b/.test(text) || /තියෙ/.test(sinhala))

  if (asksCatalog && !hasShoppingSearchIntent(text.replace(/\b(gift|cake|flower)\b/g, ''))) {
    return {
      text:
        'Kapruka eke cakes, flowers, chocolates, hampers, teddy bears, jewellery, watches, electronics wage godak tiyenawa. Special occasion ekakda? Nathnam gift eka katada kiyannako. Mama fit wenama pick karannam.',
      chips: ['Birthday', 'Anniversary', 'For wife', 'For friend'],
    }
  }

  const sadOrEmotional =
    /\b(mama )?(duken|duka|sad|upset|down|dukai|dukak|tharaha|kopa|alone|lonely)\b/.test(
      text
    ) ||
    /\bi'?m in sad mood\b/.test(text) ||
    /ඩුකෙන්|දුකෙන්|දුක|තනිය/.test(sinhala)

  if (sadOrEmotional) {
    return {
      text:
        'Ane, ehema ahala dukai. Oya kamathi nam mokakda une kiyannako, mama ahagena innam. Gift hoyana eka passe balamuda.',
      chips: ['Mata kiyanna one', 'Gift ekak balamu', 'Later'],
    }
  }

  const wantsToTell =
    /\b(mata|mta)\s+(kiyanna|kiyana|katha karanna|talk karanna)\s+(one|ona|oni|oneda)\b/.test(
      text
    ) || /මට කියන්න ඔනෙ|මට කියන ඔනෙ/.test(sinhala)

  if (wantsToTell) {
    return {
      text:
        'Hari, mata kiyannako. Mama ahagena innam. Mokakda une kiyala oyata puluwan widihata kiyanna.',
      chips: ['Duka hithuna', 'Problem ekak', 'English walin kiyanna'],
    }
  }

  const asksUnderstanding =
    /\b(therenawada|therenawa da|understand|understood)\b/.test(text) ||
    /\b(oyata|oya) mama kiyana eka\b/.test(text) ||
    /තෙරෙන|තේරෙන/.test(sinhala)

  if (asksUnderstanding) {
    return {
      text:
        'Ow, mata theranawa. Oya Singlish walinma kiyannako, mama therena widihata simple reply karannam.',
      chips: ['Hari', 'Gift ekak balamu', 'Mama explain karannam'],
    }
  }

  const thanksOnly = isShort(text, 6) && /\b(thank|thanks|thank you|istuti|sthuthi)\b/.test(text)
  if (thanksOnly) {
    return {
      text: 'Hari, anytime! Mokak hari one nam kiyannako, mama help karannam.',
      chips: ['Gift ekak', 'Cake ekak', 'Track order'],
    }
  }

  return null
}
