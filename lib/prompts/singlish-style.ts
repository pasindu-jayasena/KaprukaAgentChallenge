/** Injected for local-language chat written in Latin script. */
export const SINGLISH_STYLE_BLOCK = `SINGLISH - NATURAL & POLITE
Write like a friendly Kapruka shop assistant in Sri Lanka: easy English + common Sinhala words in Latin script. Sound local, not textbook.

TONE
- Warm and respectful, like helping a customer in a good gift shop.
- Soft questions, never commands. Use short familiar phrasing: "katada?", "kiyada?", "ok da?", "kiyanna".
- 2-3 short sentences. Match their mix: if they use Singlish, reply in Singlish.
- Give one clear seller opinion before asking anything.
- Use Sri Lankan customer-service warmth, not buddy slang.
- Do not ask full English follow-up questions after a Singlish message. Keep the question in Singlish.
- If they ask "kohomada", answer "Mama hodin" not "Mama hondai".

NEVER USE
- kiyapan, enna, balapan, yanna, ganna as blunt orders.
- machan, bn, ban, yakko, ane manda in assistant replies.
- "mage kello" or "kawda mage"; you are Anu, not the customer.
- Stiff phrases nobody types, like "kawurata da", "mokakda", "monavada hobby?" by itself.
- "Kata kiyanna" as a phrase. Use "Katada kiyannako?".
- "We have ekama widihata gifts". Use natural seller wording.
- Fake slang that adds Sinhala endings to every English word.

USE INSTEAD
- Who is it for: "Gift eka katada?" / "Cake eka katada?"
- Friendly who-for follow-up: "Katada kiyannako?"
- Age: "Age eka kiyada?"
- Likes: "Eyata monawada asai?"
- Budget: "Budget eka roughly kiyada?"
- Opinion: "Meka classy choice ekak. Eyata special feel wei."
- Reassurance: "Shape, mama oyata best tika pick karannam."`

export const TANGLISH_STYLE_BLOCK = `TANGLISH - NATURAL & POLITE
Write like a friendly Kapruka shop assistant in Sri Lanka: easy English + common Tamil words in Latin script. Sound local, warm, and service-minded.

TONE
- Respectful and soft. Prefer "sollunga", "paarunga", "venuma?", "ok va?".
- 2-3 short sentences. Match their mix: if they use Tanglish, reply in Tanglish.
- Give one clear seller opinion before asking anything.
- Use customer-service warmth, not street slang.
- Do not ask full English follow-up questions after a Tanglish message. Keep the question in Tanglish.

NEVER USE
- Blunt command forms like "sollu", "paaru", "vaangu" as orders.
- da, dei, machan, bro in assistant replies.
- Random Tamil endings on every English word.
- Long formal Tamil paragraphs when the customer is typing Tanglish.

USE INSTEAD
- Who is it for: "Gift yaarukku?" / "Cake yaarukku?"
- Budget: "Budget roughly evlo?"
- Likes: "Avalukku/avarukku enna pidikkum?"
- Delivery: "City and date sollunga, naan check pannuren."
- Reassurance: "Ithu nice choice. Simple-a irukkum, but thoughtful-a feel aagum."`

export function buildSinglishStyleBlock(chatLang: string): string {
  if (chatLang === 'singlish') return SINGLISH_STYLE_BLOCK
  if (chatLang === 'tanglish') return TANGLISH_STYLE_BLOCK
  return ''
}

/** Fix impolite or awkward Singlish in model output. */
export function polishSinglishText(text: string): string {
  return text
    // Remove buddy slang
    .replace(/\bmachan[,!.\s]*/gi, '')
    .replace(/\bbro[,!.\s]*/gi, '')
    .replace(/\bban[,!.\s]*/gi, '')
    .replace(/\bbn[,!.\s]*/gi, '')
    .replace(/\byakko[,!.\s]*/gi, '')
    .replace(/\bdei[,!.\s]*/gi, '')
    // Fix "how are you" responses
    .replace(/\bMama hondai\b/gi, 'Mama hodin')
    .replace(/\bMata hondai\b/gi, 'Mama hodin')
    .replace(/\bI am good\b/gi, 'Mama hodin')
    .replace(/\bI'?m good\b/gi, 'Mama hodin')
    .replace(/\bmama honda\b/gi, 'mama hodin')
    // Fix command forms → polite forms
    .replace(/\bkiyapan\b/gi, 'kiyanna puluwanda')
    .replace(/\bennna\b/gi, 'kiyanna puluwanda')
    .replace(/\bbalapan\b/gi, 'balanna puluwanda')
    .replace(/\byannapan\b/gi, 'yanna puluwanda')
    .replace(/\bgannapan\b/gi, 'ganna puluwanda')
    // Fix awkward who-for phrasing
    .replace(/\bkawda mage kello\b/gi, 'gift eka katada')
    .replace(/\bmage kello\b/gi, 'kellek')
    .replace(/\bKata kiyanna\b/g, 'Katada kiyannako')
    .replace(/\bkata kiyanna\b/gi, 'katada kiyannako')
    .replace(/\bKata kiyala denna\b/g, 'Katada kiyannako')
    .replace(/\bkata kiyala denna\b/gi, 'katada kiyannako')
    .replace(/\bkata kiyannako\b/gi, 'katada kiyannako')
    // Fix "kawurata" → "katada" (the main user complaint)
    .replace(/\bkawurata da\b/gi, 'katada')
    .replace(/\bkawurata\b/gi, 'katada')
    .replace(/\bkaatada\b/gi, 'katada')
    .replace(/\bkavurutada\b/gi, 'katada')
    .replace(/\bkavurata\b/gi, 'katada')
    // Fix budget phrasing (the other main complaint)
    .replace(/\bbudget eka roughly mokakda\??\b/gi, 'Budget eka roughly kiyada?')
    .replace(/\bbudget roughly mokakda\??\b/gi, 'Budget eka roughly kiyada?')
    .replace(/\broughly mokakda\??\b/gi, 'roughly kiyada?')
    .replace(/\bbudget eka mokakda\??\b/gi, 'Budget eka kiyada?')
    .replace(/\bmokakda budget\??\b/gi, 'Budget eka kiyada?')
    // Fix other awkward textbook phrases
    .replace(/\bmonavada hobby\?\b/gi, 'eyata monawada asai?')
    .replace(/\bmonawada kamathi tiyenavada kiyala denna puluwanda\??\b/gi, 'eyata monawada asai?')
    .replace(/\bage eka kiyapan\b/gi, 'age eka kiyala denna puluwanda')
    .replace(/\bbalanna puluwanda:\s*/gi, 'balanna, ')
    .replace(/\bMokakda hithenawa\?/gi, 'oyata mokakda hithenne?')
    .replace(/\bmokada\b/gi, 'mokakda')
    .replace(/\bmonawada\b(?!\s+asai)/gi, 'monawada')
    // Fix stiff chatbot phrases
    .replace(/\bOyata mokada ganna ona today\?/gi, 'Mokakda help wenna one?')
    .replace(/\bmokada ganna ona today\?/gi, 'mokakda one?')
    .replace(/\bOyata enna puluwan kiyala kiyanna\b/gi, 'Oyata one de kiyannako')
    .replace(/\bMokada balanakota kamathi, kiyala denna\??\b/gi, 'Mokakda balanne kiyannako?')
    .replace(/\bmama reply karanawa\b/gi, 'mama reply karannam')
    .replace(/\bWe have ekama widihata gifts\b/gi, 'Kapruka eke gifts godak tiyenawa')
    .replace(/\bekama widihata gifts\b/gi, 'gifts godak')
    // Remove corporate self-description
    .replace(/\bapi customers ta gift dena company ekak[.!]?\s*/gi, '')
    .replace(/\bapi eka gift-delivery company ekak[.!]?\s*/gi, '')
    .replace(/\bMamata?\s+Anu,\s*/gi, 'Mama Anu, ')
    .replace(/\bFlowers dukenekda\?\s*Shape!\s*/gi, 'Ane, ehema ahala dukai. Flowers ekka short note ekak dammoth better. ')
    // Fix double negatives and awkward constructions
    .replace(/\bhambune naha\b/gi, 'hambune naha')
    .replace(/\bhambune na\b/gi, 'hambune naha')
}

/** Fix impolite or awkward Tanglish in model output. */
export function polishTanglishText(text: string): string {
  return text
    // Remove buddy slang
    .replace(/\bmachan[,!.\s]*/gi, '')
    .replace(/\bbro[,!.\s]*/gi, '')
    .replace(/\bdei[,!.\s]*/gi, '')
    .replace(/\bda[,!]\s/gi, ' ')
    // Fix command forms → polite forms
    .replace(/\bsollu\b/gi, 'sollunga')
    .replace(/\bpaaru\b/gi, 'paarunga')
    .replace(/\bvaangu\b/gi, 'order pannalama')
    .replace(/\bpodu\b(?!ng)/gi, 'podunga')
    // Fix awkward phrasing
    .replace(/\brecipient yaaru\?\b/gi, 'Yaarukku gift venum? Recipient name sollunga?')
    .replace(/\bevlo budget\?\b/gi, 'Budget roughly evlo nu sollunga?')
    .replace(/\bbudget enna\?\b/gi, 'Budget roughly evlo?')
    .replace(/\bbudget evvalavu\?\b/gi, 'Budget roughly evlo?')
    // Remove corporate self-description
    .replace(/\bnanga oru gift company[.!]?\s*/gi, '')
    .replace(/\bnaanga customers-ku gift deliver pannura company[.!]?\s*/gi, '')
}

/** Fix stiff corporate English in model output. */
export function polishEnglishText(text: string): string {
  return text
    // Remove corporate self-description
    .replace(/\bWe are a gift delivery company[.!]?\s*/gi, '')
    .replace(/\bI am an AI assistant[.!]?\s*/gi, '')
    .replace(/\bAs an AI[,.]?\s*/gi, '')
    .replace(/\bAs a virtual assistant[,.]?\s*/gi, '')
    // Make language warmer
    .replace(/\bI would be happy to help you\b/gi, 'Happy to help')
    .replace(/\bI would be glad to assist\b/gi, 'I can help with that')
    .replace(/\bPlease do not hesitate to\b/gi, 'Feel free to')
    .replace(/\bKindly provide\b/gi, 'Just tell me')
    .replace(/\bCould you please provide\b/gi, 'What is')
}

export function polishAssistantText(text: string, chatLang: string): string {
  if (chatLang === 'singlish') return polishSinglishText(text)
  if (chatLang === 'tanglish') return polishTanglishText(text)
  if (chatLang === 'en') return polishEnglishText(text)
  return text
}
