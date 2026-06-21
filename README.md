# Kapruka Anu — Gift Concierge

AI shopping assistant for Kapruka with a high-fidelity homepage and **Anu** chat concierge.

## Features

- **Homepage**: Kapruka-branded nav, Father's Day hero, 10 category circles
- **Chat** (`/chat`): Opening → flow phases, journey bar, product trio, plan board, checkout card, order tracking
- **Languages**: Full UI in **English / සිංහල / தமிழ்**; chat mirrors user input (EN, SI, TA, Singlish, Tanglish)
- **Cart**: Zustand sidebar with qty, gift message, saved recipient
- **AI**: Gemini flash-lite + Kapruka MCP (7 tools)

## Setup

```bash
cd kapruka-anu
npm install
cp .env.example .env.local
# Add GEMINI_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy

```bash
vercel
vercel env add GEMINI_API_KEY production
vercel --prod
```

## Project structure

```
app/           # Routes: /, /chat, /api/chat
components/    # UI: layout, homepage, chat, cart
lib/           # i18n, prompts, MCP client, language detection
store/         # Zustand cart + recipient
schemas/       # Zod validation
```
