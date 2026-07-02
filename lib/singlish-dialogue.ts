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
  return /\b(show|find|search|browse|buy|order|checkout|cake|flower|flowers|gift|chocolate|hamper|teddy|watch|jewellery|perfume|under|budget|grocer(?:y|ies)|rice|milk|snack|phone|charger|electronics?|fashion|dress|home item|daily essentials?|mata ganna|ganna one|ganna ona|denna one|denna ona)\b/i.test(
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

  const emotionalFlowerRequest =
    /\b(duken|duka|sad|upset|tharaha|kopa|breakup|broke up|girlfriend|wife|sorry|sory|apology)\b/.test(text) &&
    /\b(flowers?|gift|chocolate|note|denna one|denna ona|send)\b/.test(text)

  if (emotionalFlowerRequest) {
    return {
      text:
        'Ane, ehema ahala dukai. Apology ekak nam flowers ekka short note ekak dammoth better. Courier ekata wada oyata puluwan nam hand-deliver karana eka more human. Flower picks balamuda?',
      chips: ['Show flower picks', 'Note eka liyamu', 'Keep it simple'],
    }
  }

  const asksHowAreYou =
    isShort(text) &&
    (/\b(kohomada|oyata kohomada|kohomada oyata|kohomada oyage)\b/.test(text) ||
      /කොහොම/.test(sinhala))

  if (asksHowAreYou) {
    return {
      text:
        'Mama hodin, thank you! Oyata kohomada? Mokak hari ganna help oneda - gift ekakda, nathnam oyata ona deyakda?',
      chips: ['Mata ganna one', 'Gift ekak', 'Groceries', 'Just browsing'],
    }
  }

  const asksCatalog =
    (/\b(monawada|mona wada|mokakda)\b/.test(text) || /මොනව/.test(sinhala)) &&
    (/\b(tiyenne|tiyenawada|available|have)\b/.test(text) || /තියෙ/.test(sinhala))

  if (asksCatalog && !hasShoppingSearchIntent(text.replace(/\b(gift|cake|flower)\b/g, ''))) {
    return {
      text:
        'Kapruka eke godak dewal tiyenawa - groceries, electronics, fashion, cakes, flowers, chocolates, hampers. Oyata ganna oneda, nathnam gift ekakda? Mama fit wena tika pick karannam.',
      chips: ['Mata ganna one', 'Gift ekak', 'Groceries', 'Electronics'],
    }
  }

  const sadOrEmotional =
    /\b(mama )?(duken|duka|sad|upset|down|dukai|dukak|tharaha|kopa|alone|lonely)\b/.test(
      text
    ) ||
    /\bi'?m in sad mood\b/.test(text) ||
    /ඩුකෙන්|දුකෙන්|දුක|තනිය/.test(sinhala)

  if (sadOrEmotional && !hasShoppingSearchIntent(text)) {
    return {
      text:
        'Ane, ehema ahala dukai. Oya kamathi nam mokakda une kiyannako, mama ahagena innam. Gift hoyana eka passe balamuda.',
      chips: ['Mata kiyanna one', 'Flowers balamu', 'Later'],
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
      chips: ['Mata ganna one', 'Gift ekak', 'Groceries', 'Track order'],
    }
  }

  // Agreement responses — keep conversation moving
  const agreementOnly = isShort(text, 4) && /^\s*(ow|hari|ok|okkoma|seri|yep|yes|ow hari|hari hari|hmm|okkoma hari)\s*$/i.test(text)
  if (agreementOnly) {
    return {
      text: 'Shape! Mokakda next step eka? Gift ekak hoyanawada, nathnam oyata ganna deyak oneda?',
      chips: ['Gift ekak', 'Mata ganna one', 'Groceries', 'Track order'],
    }
  }

  // Disagreement / change request
  const disagreement = isShort(text, 6) && /\b(epa|epai|vena ekak|vena de|change karanna|maru|maru karanna|vena option|wena ekak|wena de)\b/.test(text)
  if (disagreement) {
    return {
      text: 'Hari, wena options balamu. Mokak vidihata wena karannada? Vena category ekakda, nathnam budget eka change karannada?',
      chips: ['Show chocolates', 'Show flowers', 'Change budget', 'Under Rs. 5000'],
    }
  }

  // Follow-up asking for more
  const wantsMore = isShort(text, 4) && /^\s*(thawa|thawa tiyanawada|wena ekak|more|thawa options|thawa pennanna)\s*$/i.test(text)
  if (wantsMore) {
    return {
      text: 'Hari, thawa options balamuda? Same category ekeda, nathnam vena mokak hari?',
      chips: ['Same category', 'Show flowers', 'Show chocolates', 'Different gift'],
    }
  }

  return null
}


function normalizeTanglish(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasTanglishShoppingIntent(text: string) {
  return /\b(show|find|search|browse|buy|order|checkout|cake|flower|flowers|gift|chocolate|hamper|watch|jewellery|perfume|budget|grocer(?:y|ies)|rice|milk|snack|phone|charger|electronics?|fashion|dress|home item|daily essentials?|venum|vaanga|anuppu|send|delivery)\b/i.test(text)
}

export function getTanglishDirectReply(input: string): SinglishDirectReply | null {
  const text = normalizeTanglish(input)
  if (!text) return null

  const wantsEnglish = /\b(english|inglish)\s+(la|le|in|with)\b/.test(text)
  if (wantsEnglish) {
    return {
      text: "Sure, I can reply in English. Tell me what happened, and I'll keep it simple. If you want to shop after that, I can help.",
      chips: ['Tell you', 'Help me pick a gift', 'Later'],
    }
  }

  const emotionalFlowerRequest =
    /\b(sad|kashtam|dukham|upset|kovam|sandai|breakup|pirinju|sorry|apology|girlfriend|wife)\b/.test(text) &&
    /\b(flowers?|gift|chocolate|note|send|anuppu|venum)\b/.test(text)

  if (emotionalFlowerRequest) {
    return {
      text:
        'Aiyo, adhu kashtam. Apology-na flowers plus short note romba better. Courier vida neenga hand-deliver panna more human-a feel aagum. Flower picks paakalama?',
      chips: ['Flower picks', 'Note write pannalam', 'Simple-a podu'],
    }
  }

  const asksHowAreYou =
    isShort(text) && /\b(eppadi|epdi|how are you|nalla irukkingala|saptiya)\b/.test(text)

  if (asksHowAreYou) {
    return {
      text:
        'Naan nalla irukken, nandri! Ungalukku enna venum - unga shopping-a, illa gift-a?',
      chips: ['Enakku vaanganum', 'Gift venum', 'Groceries', 'Just browsing'],
    }
  }

  const asksCatalog =
    /\b(enna|enna enna|edhu)\b/.test(text) &&
    /\b(irukku|irukka|available|have)\b/.test(text)

  if (asksCatalog && !hasTanglishShoppingIntent(text.replace(/\b(gift|cake|flower)\b/g, ''))) {
    return {
      text:
        'Kapruka-la groceries, electronics, fashion, cakes, flowers, chocolates, hampers irukku. Ungalukku vaanganuma, illa gift-a? Naan best options pick pannuren.',
      chips: ['Enakku vaanganum', 'Gift venum', 'Groceries', 'Electronics'],
    }
  }

  const sadOrEmotional = /\b(sad|kashtam|dukham|upset|down|thani|lonely|kovam|sandai|breakup|pirinju)\b/.test(text)

  if (sadOrEmotional && !hasTanglishShoppingIntent(text)) {
    return {
      text:
        'Aiyo, adhu kashtam. Neenga comfortable-na enna aachu sollunga, naan ketkiren. Shopping later paathukkalam.',
      chips: ['Solla venum', 'Flowers paakalam', 'Later'],
    }
  }

  const asksUnderstanding =
    /\b(puriyudha|purinjidha|understand|understood)\b/.test(text) ||
    /\b(naan solradhu|enakku solla)\b/.test(text)

  if (asksUnderstanding) {
    return {
      text:
        'Aama, puriyudhu. Neenga Tanglish-la simple-a sollunga, naan adhe style-la reply pannuren.',
      chips: ['Seri', 'Gift paakalam', 'English-la sollu'],
    }
  }

  const thanksOnly = isShort(text, 6) && /\b(thank|thanks|nandri)\b/.test(text)
  if (thanksOnly) {
    return {
      text: 'Anytime! Edhavadhu venumna sollunga, naan help pannuren.',
      chips: ['Enakku vaanganum', 'Gift venum', 'Groceries', 'Track order'],
    }
  }

  // Agreement responses
  const agreementOnly = isShort(text, 4) && /^\s*(seri|ok|aama|yep|yes|hmm|seri seri|seri da)\s*$/i.test(text)
  if (agreementOnly) {
    return {
      text: 'Seri! Next step enna? Gift-a, illa ungalukku vaanganuma?',
      chips: ['Gift venum', 'Enakku vaanganum', 'Groceries', 'Track order'],
    }
  }

  // Disagreement / change request
  const disagreement = isShort(text, 6) && /\b(venda|vena option|change|vera|vera option|maathu|maathi|vera edhu)\b/.test(text)
  if (disagreement) {
    return {
      text: 'Seri, vera options paakalam. Enna madhiri maathanum? Vera category-aa, illa budget change-aa?',
      chips: ['Show chocolates', 'Show flowers', 'Change budget', 'Under Rs. 5000'],
    }
  }

  return null
}


export function getSinhalaDirectReply(input: string): SinglishDirectReply | null {
  const text = input.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!text) return null

  const hasSinhala = Array.from(text).some((ch) => {
    const code = ch.charCodeAt(0)
    return code >= 0x0d80 && code <= 0x0dff
  })
  const hasCodes = (...codes: number[]) => codes.every((code) => text.includes(String.fromCharCode(code)))

  const asksHowAreYou = hasSinhala && hasCodes(0x0d9a, 0x0ddc, 0x0dc4, 0x0db8, 0x0daf)
  if (asksHowAreYou) {
    return {
      text: '\u0DB8\u0DB8 \u0DC4\u0DDC\u0DB3\u0DD2\u0DB1\u0DCA, \u0DC3\u0DCA\u0DAD\u0DD6\u0DAD\u0DD2\u0DBA\u0DD2! \u0D94\u0DBA\u0DCF\u0DA7 \u0D9A\u0DDC\u0DC4\u0DDC\u0DB8\u0DAF? \u0D85\u0DAF \u0D94\u0DBA\u0DCF\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1 \u0DAF\u0DD9\u0DBA\u0D9A\u0DCA\u0DAF, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA \u0D9A\u0DCF\u0DA7\u0DC4\u0DBB\u0DD2 gift \u0D91\u0D9A\u0D9A\u0DCA\u0DAF?',
      chips: ['\u0DB8\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1\u0DDA', 'Gift \u0D91\u0D9A\u0D9A\u0DCA', 'Groceries', '\u0DB6\u0DBD\u0DB1\u0DCA\u0DB1 \u0DC0\u0DD2\u0DAD\u0DBB\u0DBA\u0DD2'],
    }
  }

  const sadOnly = hasSinhala && hasCodes(0x0daf, 0x0dd4, 0x0d9a) &&
    !/flowers?|gift|order/.test(text)
  if (sadOnly) {
    return {
      text: '\u0D85\u0DBA\u0DD2\u0DBA\u0DDD, \u0D92\u0D9A \u0D85\u0DC4\u0DBD\u0DCF \u0DAF\u0DD4\u0D9A\u0DBA\u0DD2. \u0D94\u0DBA\u0DCF \u0D9A\u0DD0\u0DB8\u0DAD\u0DD2 \u0DB1\u0DB8\u0DCA \u0DB8\u0DDC\u0D9A\u0DAF \u0DC0\u0DD4\u0DAB\u0DDA \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1, \u0DB8\u0DB8 \u0D85\u0DC4\u0D9C\u0DD9\u0DB1 \u0D89\u0DB1\u0DCA\u0DB1\u0DB8\u0DCA. Shopping \u0D91\u0D9A \u0DB4\u0DC3\u0DCA\u0DC3\u0DDA \u0DB6\u0DBD\u0DB8\u0DD4.',
      chips: ['\u0DB8\u0DA7 \u0D9A\u0DD2\u0DBA\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1\u0DDA', 'Flowers \u0DB6\u0DBD\u0DB8\u0DD4', '\u0DB4\u0DC3\u0DCA\u0DC3\u0DDA'],
    }
  }

  const asksCatalog = hasSinhala && (hasCodes(0x0db8, 0x0ddc, 0x0db1) || hasCodes(0x0dad, 0x0dd2, 0x0dba, 0x0dd9, 0x0db1))
  if (asksCatalog) {
    return {
      text: 'Kapruka \u0D91\u0D9A\u0DDA groceries, electronics, fashion, cakes, flowers, chocolates, hampers \u0DC0\u0D9C\u0DDA \u0D9C\u0DDC\u0DA9\u0D9A\u0DCA \u0DAF\u0DDA\u0DC0\u0DBD\u0DCA \u0DAD\u0DD2\u0DBA\u0DD9\u0DB1\u0DC0\u0DCF. \u0D94\u0DBA\u0DCF\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1\u0DAF, \u0DB1\u0DD0\u0DAD\u0DCA\u0DB1\u0DB8\u0DCA gift \u0D91\u0D9A\u0D9A\u0DCA\u0DAF?',
      chips: ['\u0DB8\u0DA7 \u0D9C\u0DB1\u0DCA\u0DB1 \u0D95\u0DB1\u0DDA', 'Gift \u0D91\u0D9A\u0D9A\u0DCA', 'Groceries', 'Electronics'],
    }
  }

  return null
}


export function getEnglishDirectReply(input: string): SinglishDirectReply | null {
  const text = input.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null

  if (/\bi want to plan a birthday\b|\bplan a birthday\b|\bbirthday planning\b/.test(text)) {
    return {
      text:
        "Nice, let's make it feel personal. Who is the birthday for - kid, partner, parent, friend, or office person?",
      chips: ['Kid', 'Partner', 'Parent', 'Friend', 'Office'],
    }
  }

  if (/\bi want to shop for myself\b|\bshop for myself\b/.test(text)) {
    return {
      text:
        'Sure. What are you buying today - groceries, electronics, fashion, home items, or something else?',
      chips: ['Groceries', 'Electronics', 'Fashion', 'Home items'],
    }
  }

  if (/\bi need help finding an item\b|\bfind an item\b|\bfind something\b/.test(text)) {
    return {
      text:
        'Sure, I can narrow it down. What type of item are you looking for, and any budget or brand in mind?',
      chips: ['Tell item type', 'Under Rs. 5000', 'Best quality', 'Fast delivery'],
    }
  }

  if (/\bi need help with a sensitive situation\b|\bsensitive situation\b/.test(text)) {
    return {
      text:
        'Okay, I will handle this carefully. What happened - apology, breakup, argument, or are you trying to cheer someone up?',
      chips: ['Apology', 'Breakup', 'Argument', 'Cheer them up'],
    }
  }

  const emotionalFlowerRequest =
    /\b(broke up|breakup|fight|argued|sorry|apology|forgive|girlfriend|wife|heartbroken|upset)\b/.test(text) &&
    /\b(flower|flowers|gift|chocolate|note|send)\b/.test(text)

  if (emotionalFlowerRequest) {
    return {
      text:
        "Aiyo, that hurts. If this is an apology, flowers plus a short note will land better than a cold courier. My suggestion: keep it classy, add a note card, and if you can, hand-deliver it. Shall I show flower picks or help write the note first?",
      chips: ['Show flower picks', 'Write the note', 'Keep it simple'],
    }
  }

  // How are you
  if (isShort(text) && /\b(how are you|how's it going|how do you do)\b/.test(text)) {
    return {
      text: 'I am doing great, thanks for asking! How about you? What can I help you with today?',
      chips: ['Shop for myself', 'Send a gift', 'Groceries', 'Track order'],
    }
  }

  // Thanks
  const thanksOnly = isShort(text, 6) && /\b(thank|thanks|thank you|cheers)\b/.test(text)
  if (thanksOnly) {
    return {
      text: 'Happy to help! Need anything else?',
      chips: ['Shop for myself', 'Send a gift', 'Groceries', 'Track order'],
    }
  }

  // Agreement
  const agreementOnly = isShort(text, 4) && /^\s*(ok|yes|yep|sure|alright|right|hmm|yeah)\s*$/i.test(text)
  if (agreementOnly) {
    return {
      text: 'Great! What are we doing next — shopping for yourself, sending a gift, or something else?',
      chips: ['Shop for myself', 'Send a gift', 'Groceries', 'Track order'],
    }
  }

  return null
}
