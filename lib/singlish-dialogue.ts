import { convertSinglishToSinhala } from '@siyabasa/singlish'

export interface SinglishDirectReply {
  text: string
  chips?: string[]
}

// NOTE: Direct replies are ONLY for very short, unambiguous social phrases
// (greetings, thanks, plain agreement) and exact WelcomeGuide button phrases.
// Emotional, contextual, or nuanced messages must fall through to the LLM so
// Anu can respond to the customer's actual words (see CLAUDE.md AI Architecture).

const WORD_FIXES: Array<[RegExp, string]> = [
  [/\biyata\b/g, 'oyata'],
  [/\biata\b/g, 'oyata'],
  [/\boyt\b/g, 'oyata'],
  [/\bkohomd\b/g, 'kohomada'],
  [/\bkomada\b/g, 'kohomada'],
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

function isShort(text: string, maxWords = 4) {
  return text.split(/\s+/).filter(Boolean).length <= maxWords
}

export function getSinglishDirectReply(input: string): SinglishDirectReply | null {
  const text = normalize(input)
  const sinhala = transliterate(text)
  if (!text) return null

  const wantsEnglish =
    isShort(text, 6) && /\b(english|ingrisi|ingreesi)\s+(walin|valin|with|in)\b/.test(text)
  if (wantsEnglish) {
    return {
      text:
        "Sure, I can reply in English. Tell me what happened, and I'll listen first. If you want to shop after that, I can help then.",
      chips: ['Tell you', 'Help me pick a gift', 'Later'],
    }
  }

  const asksHowAreYou =
    isShort(text, 4) &&
    (/^\s*(oyata\s+)?kohomada(\s+oyata|\s+oyage)?\s*$/.test(text) || /^කොහොමද$/.test(sinhala))

  if (asksHowAreYou) {
    return {
      text:
        'Mama hodin, thank you! Oyata kohomada? Mokak hari ganna help oneda - gift ekakda, nathnam oyata ona deyakda?',
      chips: ['Mata ganna one', 'Gift ekak', 'Groceries', 'Just browsing'],
    }
  }

  const thanksOnly = isShort(text, 4) && /^\s*(thank(s| you)?|istuti|sthuthi|bohoma sthuthi)\s*!*\s*$/.test(text)
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

  return null
}


function normalizeTanglish(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getTanglishDirectReply(input: string): SinglishDirectReply | null {
  const text = normalizeTanglish(input)
  if (!text) return null

  const wantsEnglish = isShort(text, 6) && /\b(english|inglish)\s+(la|le|in|with)\b/.test(text)
  if (wantsEnglish) {
    return {
      text: "Sure, I can reply in English. Tell me what happened, and I'll keep it simple. If you want to shop after that, I can help.",
      chips: ['Tell you', 'Help me pick a gift', 'Later'],
    }
  }

  const asksHowAreYou =
    isShort(text, 4) && /^\s*(neenga\s+)?(eppadi|epdi)(\s+irukkinga(la)?)?\s*$/.test(text)

  if (asksHowAreYou) {
    return {
      text:
        'Naan nalla irukken, nandri! Ungalukku enna venum - unga shopping-a, illa gift-a?',
      chips: ['Enakku vaanganum', 'Gift venum', 'Groceries', 'Just browsing'],
    }
  }

  const thanksOnly = isShort(text, 4) && /^\s*(thank(s| you)?|nandri|romba nandri)\s*!*\s*$/.test(text)
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

  return null
}


export function getSinhalaDirectReply(input: string): SinglishDirectReply | null {
  const text = input.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!text) return null

  const hasSinhala = Array.from(text).some((ch) => {
    const code = ch.charCodeAt(0)
    return code >= 0x0d80 && code <= 0x0dff
  })
  if (!hasSinhala) return null

  // Only a short standalone "කොහොමද?" style greeting — anything longer goes to the LLM
  const asksHowAreYou =
    isShort(text, 4) && /(^|\s)(ඔයාට\s+)?කොහොමද(\s+ඔයාට)?\s*\?*\s*$/.test(text) && text.length <= 30
  if (asksHowAreYou) {
    return {
      text: 'මම හොඳින්, ස්තූතියි! ඔයාට කොහොමද? අද ඔයාට ගන්න දෙයක්ද, නැත්නම් කාටහරි gift එකක්ද?',
      chips: ['මට ගන්න ඕනේ', 'Gift එකක්', 'Groceries', 'බලන්න විතරයි'],
    }
  }

  // Standalone thanks
  const thanksOnly = isShort(text, 3) && /(ස්තූතියි|ස්තුතියි|ස්තූතී)/.test(text)
  if (thanksOnly) {
    return {
      text: 'හරි, ඔන්ම වෙලාවක! තව මොකක් හරි ඕනේ නම් කියන්න.',
      chips: ['මට ගන්න ඕනේ', 'Gift එකක්', 'Groceries'],
    }
  }

  return null
}


export function getEnglishDirectReply(input: string): SinglishDirectReply | null {
  const text = input.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null

  // Exact WelcomeGuide button phrases — deterministic routing for chip taps only
  if (/^(i want to )?plan a birthday$/.test(text)) {
    return {
      text:
        "Nice, let's make it feel personal. Who is the birthday for - kid, partner, parent, friend, or office person?",
      chips: ['Kid', 'Partner', 'Parent', 'Friend', 'Office'],
    }
  }

  if (/^(i want to )?shop for myself$/.test(text)) {
    return {
      text:
        'Sure. What are you buying today - groceries, electronics, fashion, home items, or something else?',
      chips: ['Groceries', 'Electronics', 'Fashion', 'Home items'],
    }
  }

  if (/^(i need help finding an item|find an item)$/.test(text)) {
    return {
      text:
        'Sure, I can narrow it down. What type of item are you looking for, and any budget or brand in mind?',
      chips: ['Tell item type', 'Under Rs. 5000', 'Best quality', 'Fast delivery'],
    }
  }

  // How are you
  if (isShort(text, 5) && /^(hi |hey |hello )?how are you( today| doing)?$/.test(text)) {
    return {
      text: 'I am doing great, thanks for asking! How about you? What can I help you with today?',
      chips: ['Shop for myself', 'Send a gift', 'Groceries', 'Track order'],
    }
  }

  // Thanks
  const thanksOnly = isShort(text, 4) && /^(thank(s| you)( so much| a lot)?|cheers)$/.test(text)
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
