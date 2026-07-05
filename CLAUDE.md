# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Summary

Kapruka Anu is a Next.js 16 shopping concierge for Kapruka. The app has a branded homepage, a chat-first shopping flow, product cards, cart checkout, order confirmation, payment-link generation, order tracking, browser-native voice input/output, and multilingual UI/chat behavior.

The assistant persona is Anu: a warm Sri Lankan shopping companion. Product discovery and conversation are AI-led, but checkout/payment is controlled by app UI and API routes for safety.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS via PostCSS
- Zustand for client cart/recipient state
- Zod for request validation
- Claude as primary chat model
- Groq as optional chat fallback only
- Kapruka MCP for catalog, delivery, checkout, and tracking
- Upstash Redis for production session persistence
- Browser-native SpeechRecognition and speechSynthesis for voice

## Required Commands

Run from `kapruka-anu/`.

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run start
```

Before finishing any code change, run at least:

```bash
npm run typecheck
npm run lint
npm run build
```

Known current lint state: `lib/conversation-flow.ts` may report an existing unused `lower` warning. Do not treat that as caused by unrelated changes unless you touched that area.

## Environment Variables

Required for the main app:

- `CLAUDE_API_KEY`: primary model key

Optional or production-specific:

- `CLAUDE_BASE_URL`: defaults to tokenlb-compatible Claude endpoint when not provided
- `CLAUDE_MODEL`: defaults in code
- `GROQ_API_KEY`: optional chat fallback only; not used for voice
- `GROQ_MODEL`: optional Groq fallback model
- `UPSTASH_REDIS_REST_URL`: production session persistence
- `UPSTASH_REDIS_REST_TOKEN`: production session persistence

Voice must remain browser-native. Do not reintroduce Groq, server upload, MediaRecorder transcription, or `/api/transcribe` usage for voice input/output.

## Repository Structure

- `app/`: App Router pages and API routes
- `app/api/chat/route.ts`: streaming chat endpoint, main orchestration entry
- `app/api/checkout/route.ts`: creates Kapruka order after user confirms UI review
- `app/api/checkout/preview/route.ts`: delivery/total preview before order creation
- `components/shell/`: app shell, header, navigation
- `components/home/`: homepage UI
- `components/chat/`: chat screen, product cards, plan board, receipts, tracking
- `components/cart/`: cart drawer, checkout detail fields, confirm card
- `hooks/`: browser speech, voice output, and client behavior hooks
- `lib/prompts/`: Claude/Groq system prompt and language style shaping
- `lib/server/`: server-only model/MCP/session helpers
- `lib/agent-orchestrator.ts`: exact-match shopping pipeline coordinator
- `lib/conversation-flow.ts`: checkout detail collection state machine
- `lib/conversation-context.ts`: model-facing conversation memory formatting
- `lib/chat-intent.ts`: non-shopping/follow-up intent checks
- `lib/checkout*.ts`: checkout preview, validation, profile, order parsing
- `store/`: Zustand stores
- `types/`: shared app types
- `schemas/`: Zod request schemas

## AI Architecture

The chat endpoint uses this order of operations:

1. Validate request with `chatRequestSchema`.
2. Load device/user memory and saved checkout profiles.
3. Handle checkout continuation and tracking intents before general chat.
4. Use direct replies only for very short social phrases.
5. Use agentic shopping fast paths only for obvious, unambiguous product requests.
6. Use Claude as the primary model for everything else.
7. Use Groq only as optional chat fallback when Claude is unavailable/quota-limited.
8. Parse model output into typed payloads (`chat`, `product_trio`, `plan_board`, `order_preview`, `checkout`, `order_tracking`).

Important principle: avoid expanding hardcoded conversational replies. If the user asks a nuanced question, follow-up, failure reason, recommendation, or relationship/contextual prompt, prefer the LLM path with useful context. Keep regex/fast-path logic only for deterministic routing, validation, or obvious category searches.

## Prompt and Response Rules

Primary system prompt lives in `lib/prompts/anu-system.ts`.

Preserve these behavior rules:

- Anu mirrors the user's latest language: English, Sinhala, Tamil, Singlish, or Tanglish.
- Replies should be short, warm, and seller-like.
- Do not use street slang like `machan`, `bro`, `bn`, `ban`, `da`, `dei`.
- Kapruka sells more than gifts. Do not force every request into gifting.
- Search immediately for clear product requests.
- Ask at most one question per turn.
- Keep product output structured with `<PRODUCT_TRIO>` and chips when the model is generating product recommendations.
- Never expose JSON/tool errors/CHECKOUT_DETAILS to users.

When editing model prompts, make small changes and verify that `buildPayload` in `app/api/chat/route.ts` still parses expected tags:

- `<PRODUCT_TRIO>{...}</PRODUCT_TRIO>`
- `<PLAN_BOARD>{...}</PLAN_BOARD>`
- `<CHIPS>[...]</CHIPS>`
- `<ORDER_TRACKING>{...}</ORDER_TRACKING>`

## Shopping and Product Rules

Kapruka product data should come from MCP search/get-product tools, not invented products.

Product cards expect:

- `id`
- `name`
- `price`
- `image`
- `url`
- optional `reason`, `description`, `pick`, `in_stock`

For fast paths in `lib/agent-orchestrator.ts`:

- Keep them narrow.
- They should only fire for obvious shopping/category requests.
- They must return `null` when context is ambiguous so the LLM can decide.
- Do not make the fast paths answer broad emotional or contextual questions with generic hardcoded copy.

## Checkout Rules

Checkout flow is intentionally UI-confirmed.

The model may prepare a plan or order preview, but must not directly create orders. Order creation happens only after the user presses Confirm on a review card.

Main files:

- `app/api/checkout/route.ts`
- `app/api/checkout/preview/route.ts`
- `lib/checkout.ts`
- `lib/checkout-validation.ts`
- `lib/parse-order-result.ts`
- `components/cart/OrderConfirmCard.tsx`
- `components/chat/AnuConcierge.tsx`
- `components/chat/PlanBoardCard.tsx`

Checkout must collect and validate:

- actual recipient name, not only relationship labels like girlfriend/wife/friend
- phone
- full address
- city
- delivery date
- sender name
- sender email, defaulting to `guest@kapruka.com` if needed
- optional gift message
- optional special instructions

Do not skip the review card. The sequence should be:

1. Collect details.
2. Show preview/review card with delivery fee/total when possible.
3. User presses Confirm.
4. `app/api/checkout/route.ts` calls Kapruka MCP create-order.
5. Show payment link/order receipt if returned.

Checkout errors should be specific when possible. The API currently returns `error`, and may include `reason`/masked `details`. Client handlers log failed checkout responses for diagnosis. Do not replace this with a generic-only message.

## Voice Rules

Voice input/output is browser-native only.

- `hooks/useSpeech.ts`: uses `window.SpeechRecognition || window.webkitSpeechRecognition`
- `hooks/useTextToSpeech.ts`: uses `window.speechSynthesis`
- `hooks/useVoiceOutput.tsx`: global muted-by-default voice output state

Language mapping:

- `en -> en-LK`
- `si -> si-LK`
- `ta -> ta-LK`

The header speaker toggle controls reading assistant messages. Default must remain muted. Do not add speaker buttons to every message unless explicitly requested.

## UI and UX Rules

This app is a shopping tool, not a marketing-only landing page. The first screen should stay useful and product-oriented.

General UI expectations:

- Keep the Kapruka purple/yellow brand identity.
- Use `lucide-react` icons for controls when possible.
- Do not create nested cards or excessive decorative panels.
- Keep chat/product/card layouts responsive on mobile and desktop.
- Product cards need stable image/card dimensions to avoid layout shift.
- Text must not overflow buttons/cards on mobile.
- Do not add visible instructional copy explaining app internals.
- For chat, keep controls compact and workflow-focused.

When changing UI, verify visually at mobile and desktop sizes if feasible.

## Session and Memory Rules

Session persistence uses cookies plus storage helpers.

Relevant files:

- `app/api/sessions/route.ts`
- `app/api/sessions/[id]/route.ts`
- `lib/server/session-cookies.ts`
- `lib/server/session-store.ts`
- `lib/server/user-memory.ts`
- `store/recipientStore.ts`

Production persistence depends on Upstash Redis. Without Upstash, local/serverless memory may not persist reliably. Do not assume in-memory sessions are durable in Vercel.

## Security and Privacy

- Never commit `.env.local` or real API keys.
- Mask sensitive checkout diagnostics when exposing details to the browser.
- Do not show raw MCP errors, JSON, phone numbers, or emails in assistant-facing chat text.
- Keep checkout/order creation server-side.
- Respect `next.config.ts` CSP and remote image domains.

## Coding Standards

- Use TypeScript types from `types/` where possible.
- Use Zod schemas for API request validation.
- Keep server-only logic in server files/API routes.
- Keep client hooks/components behind `'use client'` when needed.
- Prefer small, focused changes over broad rewrites.
- Follow existing patterns before adding new abstractions.
- Avoid adding new dependencies unless the benefit is clear.
- Preserve current user data and cart behavior.
- Do not remove user-facing functionality while fixing unrelated issues.

## Debugging Checkout Failures

If `/api/checkout` returns 400:

1. Inspect the Network tab Response body, not only Headers.
2. Check browser console for `[chat-preview-confirm] Checkout failed`, `[chat-plan-confirm] Checkout failed`, or `[cart-confirm] Checkout failed`.
3. Check Vercel function logs for `Checkout error:` and `[Kapruka order parse failed]`.
4. Confirm the deployed commit includes the latest checkout parser/reporting changes.
5. Confirm the item IDs are real Kapruka product IDs from MCP results.
6. Confirm city/date/product availability with Kapruka MCP.

Common causes:

- Kapruka MCP did not return a payment link/order reference.
- Product is unavailable/out of stock.
- Delivery city/date is invalid or unsupported.
- MCP rate limit.
- Response shape changed and parser needs to support a new key/path.

## Deployment Notes

The repo has been deployed through Git/Vercel. Usual production update path:

```bash
git status
git add <changed files>
git commit -m "Clear message"
git push origin main
git checkout production
git merge --ff-only main
git push origin production
git checkout main
```

Only run direct Vercel deployment commands when the environment allows it and the user explicitly wants that path.

## Before Finishing Any Task

- Re-read the user request and make sure the newest request is addressed.
- Check `git diff` for accidental unrelated edits.
- Run typecheck/lint/build for code changes.
- Mention any checks that failed or were not run.
- If pushing/deploying, report the commit hash and branch status.