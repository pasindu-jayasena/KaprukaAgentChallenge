# Kapruka Anu — AI Shopping Concierge

AI shopping assistant for Kapruka with a branded homepage and **Anu**, a warm Sri Lankan shopping companion who chats, searches the live Kapruka catalog, and drives checkout end-to-end.

**Live demo:** https://kapruka-anu.vercel.app

## Features

- **Homepage**: Kapruka-branded nav, hero, category circles
- **Chat** (`/chat`): Claude-driven conversation, product carousels with a "show more" affordance, plan board, order confirm, payment slip, order tracking, and global multi-chat cart
- **Real cart actions**: Anu can add a shown product to the cart directly from chat (`<ADD_TO_CART>`), never just claims it
- **Languages**: UI in **English / සිංහල / தமிழ்**; chat mirrors user input (EN, SI, TA, Singlish, Tanglish) with dominant-script-aware text-to-speech
- **Cart**: Global across all chats — sidebar checkout with live delivery preview
- **Voice**: Browser-native speech recognition and text-to-speech, mic language follows the active conversation
- **AI**: Claude (primary) + optional Groq chat backup + Kapruka MCP catalog/delivery/orders/tracking
- **Security**: Zod-validated requests, per-route rate limiting (Upstash), server-side price verification against the Kapruka catalog before order creation

## Setup

```bash
cd kapruka-anu
npm install
cp .env.example .env.local
# Fill in keys (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `CLAUDE_API_KEY` | Yes | Primary chat brain |
| `CLAUDE_BASE_URL` | No (default: tokenlb) | Claude API base URL |
| `CLAUDE_MODEL` | No | Default: `claude-sonnet-4-6` |
| `GROQ_API_KEY` | Optional | Backup chat only; voice uses browser APIs |
| `GROQ_MODEL` | No | Default: `llama-3.3-70b-versatile` |
| `UPSTASH_REDIS_REST_URL` | **Production** | Persistent chat sessions |
| `UPSTASH_REDIS_REST_TOKEN` | **Production** | Persistent chat sessions |

Without Upstash Redis, sessions work locally but **do not persist reliably on serverless** (each deploy/instance has separate memory).

## Pre-publish checks

```bash
npm run typecheck
npm run lint
npm run build
npm run start   # smoke-test on http://localhost:3000
```

## Deploy (Vercel)

```bash
vercel
vercel env add CLAUDE_API_KEY production
vercel env add GROQ_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel --prod
```

Ensure production env has **Claude** and **Upstash Redis** for sessions. Groq is optional for chat fallback only.

## Project structure

```
app/           # Routes: /, /chat, API routes
components/    # UI: shell, homepage, chat, cart
lib/           # i18n, prompts, MCP client, chat intent
store/         # Zustand cart + recipient
schemas/       # Zod validation
```
