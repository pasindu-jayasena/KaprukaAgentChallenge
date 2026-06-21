# Kapruka Anu — Gift Concierge

AI shopping assistant for Kapruka with a branded homepage and **Anu** chat concierge.

## Features

- **Homepage**: Kapruka-branded nav, hero, category circles
- **Chat** (`/chat`): Product carousel, plan board, order confirm, payment slip, order tracking
- **Languages**: UI in **English / සිංහල / தமிழ்**; chat mirrors user input (EN, SI, TA, Singlish, Tanglish)
- **Cart**: Sidebar checkout with delivery preview
- **AI**: Claude (primary) + Groq (backup & voice) + Kapruka MCP catalog/orders

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
| `CLAUDE_API_KEY` | One of Claude or Groq | Primary chat brain |
| `CLAUDE_BASE_URL` | No (default: tokenlb) | Claude API base URL |
| `CLAUDE_MODEL` | No | Default: `claude-sonnet-4-6` |
| `GROQ_API_KEY` | One of Claude or Groq | Backup chat + voice transcription |
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

Ensure production env has at least **Claude or Groq** and **Upstash Redis** for sessions.

## Project structure

```
app/           # Routes: /, /chat, API routes
components/    # UI: shell, homepage, chat, cart
lib/           # i18n, prompts, MCP client, chat intent
store/         # Zustand cart + recipient
schemas/       # Zod validation
```
