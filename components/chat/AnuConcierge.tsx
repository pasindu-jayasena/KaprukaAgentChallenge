'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/shell/AppShell'
import { RecentSessionsSidebar } from '@/components/chat/RecentSessionsSidebar'
import { ProgressInputBar } from '@/components/chat/ProgressInputBar'
import { SentReceipt } from '@/components/chat/SentReceipt'
import { AnuLogoMark } from '@/components/shell/AnuLogoMark'
import { FlowThinking } from '@/components/chat/FlowThinking'
import { ProductTrioCard } from '@/components/chat/ProductTrioCard'
import { PlanBoardCard } from '@/components/chat/PlanBoardCard'
import { LockedCheckoutCard } from '@/components/chat/LockedCheckoutCard'
import { OrderConfirmCard } from '@/components/cart/OrderConfirmCard'
import { OrderTrackingCard } from '@/components/chat/OrderTrackingCard'
import { WelcomeGuide } from '@/components/chat/WelcomeGuide'
import { useLanguage } from '@/providers/LanguageProvider'
import { useCartStore } from '@/store/cartStore'
import { detectChatLanguage } from '@/lib/detect-language'
import { ANU_GREETINGS } from '@/config/site'
import {
  addToCartFollowUp,
  getAfterAddToCartChips,
  getAfterCheckoutChips,
  getOccasionChips,
  inferChipsFromAssistantText,
  mergeChips,
} from '@/lib/recommendation-chips'
import type {
  ChatMessage,
  ChatPayload,
  CheckoutSuccessPayload,
  ProductTrio,
  PlanBoard,
  OrderTracking,
  OrderResult,
  StatusEvent,
  SessionRecord,
  CartItem,
  CartAction,
  ChatLang,
  UiLang,
  CheckoutDetailsInput,
} from '@/types'
import { formatCheckoutUserDisplay, enrichMessageForModel } from '@/lib/conversation-context'
import { useRecipientStore } from '@/store/recipientStore'
import { useVoiceOutput } from '@/hooks/useVoiceOutput'

function getGreeting(uiLang: string): string {
  if (uiLang === 'si') return ANU_GREETINGS.si
  if (uiLang === 'ta') return ANU_GREETINGS.ta
  return ANU_GREETINGS.en
}

/** Pick the TTS voice from the message's actual script, not the UI language. */
function detectSpeechLang(text: string): UiLang {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x0d80 && code <= 0x0dff) return 'si'
    if (code >= 0x0b80 && code <= 0x0bff) return 'ta'
  }
  return 'en'
}

function isCheckoutCollectionText(text: string) {
  return /\b(actual recipient|who should receive|recipient name|receive this order|phone number|delivery address|full delivery address|delivery date|sender name|who is sending|checkout karanna|ewannako|anuppunga|address eka poddak madi|address is a bit too short|recipient address is required)\b/i.test(text)
}

function isFlowPayload(payload: ChatPayload | undefined) {
  return payload?.type === 'order_preview' || payload?.type === 'checkout' || payload?.type === 'order_tracking'
}

type CheckoutFailureResponse = {
  error?: string
  reason?: string
  details?: string
}

function checkoutFailureMessage(data: CheckoutFailureResponse) {
  return data.error || data.reason || 'Checkout failed. Please double-check your details and try again.'
}

function logCheckoutFailure(source: string, res: Response, data: CheckoutFailureResponse) {
  if (!res.ok) {
    console.error(`[${source}] Checkout failed`, {
      status: res.status,
      error: data.error,
      reason: data.reason,
      details: data.details,
    })
  }
}
function AnuChatInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { messages, uiLang } = useLanguage()
  const { muted: voiceMuted, read: readAloud, prime: primeVoice } = useVoiceOutput()
  const cartItems = useCartStore((s) => s.items)
  const removeItems = useCartStore((s) => s.removeItems)
  const savedProfiles = useRecipientStore((s) => s.profiles)

  const clearCheckedOutCart = useCallback(
    (snapshot: CartItem[]) => {
      removeItems(snapshot.map((i) => i.id))
    },
    [removeItems]
  )

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [confirmingOrder, setConfirmingOrder] = useState(false)
  const [statusLines, setStatusLines] = useState<StatusEvent[]>([])
  const [journeyStep, setJourneyStep] = useState(0)
  const [suggestedChips, setSuggestedChips] = useState<string[]>([])
  // Mic recognition language: follows the chat once the customer starts
  // conversing, otherwise the UI language
  const [chatMicLang, setChatMicLang] = useState<UiLang | null>(null)
  const micLang = chatMicLang ?? uiLang
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSent = useRef(false)
  const loaded = useRef(false)
  const pendingSession = useRef<string | null>(null)
  const lastLocalChatLang = useRef<Exclude<ChatLang, 'en'> | null>(null)
  const lastSpokenMessage = useRef<string | null>(null)
  const lastFailedText = useRef<string | null>(null)

  const persistSession = useCallback(
    async (patch: Partial<SessionRecord> & { messages?: ChatMessage[] }) => {
      if (!sessionId) return
      const lastUser = [...(patch.messages ?? chatMessages)]
        .reverse()
        .find((m) => m.role === 'user')
      const snapshot = patch.cartSnapshot ?? useCartStore.getState().items
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patch,
          preview: lastUser?.content?.slice(0, 80) ?? '',
          productCount: snapshot.reduce((n, i) => n + i.quantity, 0),
          cartSnapshot: snapshot,
        }),
      })
    },
    [sessionId, chatMessages]
  )

  const resetChatUi = useCallback(() => {
    autoSent.current = false
    setIsStreaming(false)
    setStatusLines([])
    setSuggestedChips([])
    setInput('')
  }, [])

  const applySession = useCallback(
    (id: string, session: SessionRecord) => {
      pendingSession.current = id
      setSessionId(id)
      setChatMessages(session.messages)
      setJourneyStep(session.journeyStep ?? 0)

      // The cart is GLOBAL: it keeps everything the customer added across all
      // chats. Switching or opening a chat never clears or replaces it — each
      // chat only shows its own product cards, while the cart drawer shows all.

      router.replace(`/chat?session=${id}`, { scroll: false })
    },
    [router]
  )

  const loadSession = useCallback(
    async (id: string) => {
      if (id === sessionId) return
      resetChatUi()
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (!res.ok) return
        const data = (await res.json()) as { session: SessionRecord }
        applySession(id, data.session)
      } catch (err) {
        console.error('Error loading session:', err)
      }
    },
    [sessionId, resetChatUi, applySession]
  )

  const startNewChat = useCallback(async () => {
    resetChatUi()
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: messages.sessions.newChat }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { id?: string; session?: SessionRecord }
    if (data.id && data.session) {
      applySession(data.id, data.session)
    }
  }, [resetChatUi, applySession, messages.sessions.newChat])

  useEffect(() => {
    const paramSession = searchParams.get('session')

    // If the URL caught up to what we just pushed, clear the pending lock
    if (paramSession === pendingSession.current) {
      pendingSession.current = null
    }

    if (paramSession) {
      // Only load from URL if we aren't already navigating to a new session
      if (paramSession !== sessionId && !pendingSession.current) {
        void loadSession(paramSession)
      }
      return
    }

    if (loaded.current) return
    loaded.current = true

    const init = async () => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: messages.sessions.newChat }),
      })
      const data = (await res.json()) as { id?: string; session?: SessionRecord }
      if (data.id && data.session) {
        applySession(data.id, data.session)
      } else {
        setChatMessages([{ role: 'assistant', content: getGreeting(uiLang) }])
      }
    }
    void init()
  }, [searchParams, sessionId, loadSession, applySession, uiLang, messages.sessions.newChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, statusLines, isStreaming])
  useEffect(() => {
    if (voiceMuted || isStreaming || !chatMessages.length) return
    const lastIndex = chatMessages.length - 1
    const last = chatMessages[lastIndex]
    if (last.role !== 'assistant' || last.isStreaming || !last.content.trim()) return
    // Review/receipt cards speak for themselves visually — don't read them out
    const payloadType = last.payload?.type
    if (payloadType === 'checkout' || payloadType === 'order_preview') return

    const id = `assistant-${lastIndex}-${last.content.slice(0, 24)}`
    if (lastSpokenMessage.current === id) return
    lastSpokenMessage.current = id

    let spoken = last.content
    if (last.payload?.type === 'product_trio') {
      const trio = last.payload.trio as ProductTrio | undefined
      const top = trio?.products?.find((p) => p.pick) ?? trio?.products?.[0]
      if (top?.name) {
        spoken += `. Top pick: ${top.name}, ${Math.round(top.price ?? 0).toLocaleString()} rupees.`
      }
    }
    readAloud(id, spoken, detectSpeechLang(spoken))
  }, [chatMessages, isStreaming, readAloud, voiceMuted])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      // Sending is a user gesture — keep the speech engine unlocked so the
      // reply can be read aloud when the speaker is on.
      if (!voiceMuted) primeVoice()

      const detectedRaw = detectChatLanguage(text)
      const isShortReply = text.trim().split(/\s+/).length <= 5
      const wantsEnglish = /\b(english|ingrisi|ingreesi)\s+(walin|valin|with|in)\b/i.test(text)
      const detected =
        wantsEnglish
          ? 'en'
          : detectedRaw === 'en' && isShortReply && lastLocalChatLang.current
          ? lastLocalChatLang.current
          : detectedRaw
      if (wantsEnglish) lastLocalChatLang.current = null
      if (detected !== 'en') lastLocalChatLang.current = detected
      // Point the mic's recognition engine at the language the customer is
      // actually conversing in (singlish speakers speak Sinhala, etc.)
      setChatMicLang(
        detected === 'si' || detected === 'singlish'
          ? 'si'
          : detected === 'ta' || detected === 'tanglish'
          ? 'ta'
          : 'en'
      )
      setStatusLines([])
      setSuggestedChips([])

      const userMsg: ChatMessage = { role: 'user', content: text }
      const history = [...chatMessages, userMsg]
      setChatMessages(history)
      setInput('')
      setIsStreaming(true)

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', isStreaming: true },
      ])

      // Only send the recent window to the API — the server model caps its own
      // context anyway, and the request schema rejects overly long histories.
      const apiMessages = history.slice(-40).map((m) => ({
        role: m.role,
        content: enrichMessageForModel(m),
      }))

      const attempt = async (): Promise<{
        payload: ChatPayload | null
        displayText: string
      }> => {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(55000),
          body: JSON.stringify({
            messages: apiMessages,
            uiLang,
            chatLang: detected,
            cartItems: cartItems.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              giftMessage: i.giftMessage,
              icingText: i.icingText,
            })),
            savedProfiles: savedProfiles.length ? savedProfiles : undefined,
          }),
        })

        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`) as Error & { status?: number }
          err.status = res.status
          throw err
        }

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let payload: ChatPayload | null = null
        let displayText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const evt = JSON.parse(line) as {
                type: string
                payload?: ChatPayload & { orderResult?: OrderResult }
                label?: string
                icon?: string
                key?: string
              }
              if (evt.type === 'status' && evt.label) {
                setStatusLines((s) => [
                  ...s,
                  {
                    type: 'status',
                    icon: evt.icon ?? 'sparkles',
                    key: evt.key ?? 'working',
                    label: evt.label!,
                  },
                ])
              }
              if (evt.type === 'final' && evt.payload) {
                payload = evt.payload
                if (payload.type === 'chat') displayText = payload.text
                else if (payload.type === 'product_trio') {
                  const trioPayload = payload as { trio?: ProductTrio; rawText?: string }
                  displayText =
                    trioPayload.rawText?.trim() ||
                    trioPayload.trio?.context?.trim() ||
                    'Here are my top picks:'
                }
                else if (payload.type === 'order_preview')
                  displayText =
                    payload.text ??
                    'Please review your order below - tap Confirm when ready to get your payment link.'
                else if (payload.type === 'order_tracking')
                  displayText = payload.rawText ?? 'I found the order status.'
                else displayText = 'Got it!'
                if ('orderResult' in evt.payload && evt.payload.orderResult) {
                  payload = {
                    type: 'checkout',
                    orderResult: evt.payload.orderResult as OrderResult,
                    text: displayText,
                    items: (evt.payload as ChatPayload & { type: 'checkout' }).items,
                    cartRestore: (evt.payload as ChatPayload & { type: 'checkout' }).cartRestore,
                    recipient: (evt.payload as ChatPayload & { type: 'checkout' }).recipient,
                    subtotal: (evt.payload as ChatPayload & { type: 'checkout' }).subtotal,
                    deliveryFee: (evt.payload as ChatPayload & { type: 'checkout' }).deliveryFee,
                    total: (evt.payload as ChatPayload & { type: 'checkout' }).total,
                    giftMessage: (evt.payload as ChatPayload & { type: 'checkout' }).giftMessage,
                    senderName: (evt.payload as ChatPayload & { type: 'checkout' }).senderName,
                    senderEmail: (evt.payload as ChatPayload & { type: 'checkout' }).senderEmail,
                    specialInstructions: (evt.payload as ChatPayload & { type: 'checkout' })
                      .specialInstructions,
                  }
                }
              }
            } catch {
              /* skip */
            }
          }
        }

        return { payload, displayText }
      }

      try {
        let result: { payload: ChatPayload | null; displayText: string }
        try {
          result = await attempt()
        } catch (firstErr) {
          const status = (firstErr as { status?: number }).status
          // 4xx (bad request) won't get better on retry; transient failures might
          if (status && status >= 400 && status < 500 && status !== 429) throw firstErr
          setStatusLines([])
          await new Promise((r) => setTimeout(r, 1200))
          result = await attempt()
        }
        const { payload, displayText } = result
        lastFailedText.current = null
        let nextJourney = journeyStep

        // Execute a validated model-requested add-to-cart. This only runs in
        // the live-stream path, so restored sessions never re-add items.
        let appliedCartAction: CartAction | null = null
        if (
          payload &&
          (payload.type === 'chat' || payload.type === 'product_trio') &&
          payload.cartAction
        ) {
          const action = payload.cartAction
          useCartStore.getState().addItem({
            id: action.id,
            name: action.name,
            price: action.price,
            image: action.image ?? null,
            url: action.url ?? null,
            quantity: action.quantity,
          })
          appliedCartAction = action
        }

        if (payload?.type === 'product_trio') nextJourney = 1
        if (payload?.type === 'plan_board' || payload?.type === 'order_preview') nextJourney = 2
        if (payload?.type === 'checkout') nextJourney = 3
        if (payload?.type === 'order_tracking') nextJourney = 4
        setJourneyStep(nextJourney)

        const finalDisplayText =
          appliedCartAction && !displayText.trim()
            ? addToCartFollowUp(appliedCartAction.name, uiLang)
            : displayText

        const chipSource =
          payload && 'chips' in payload ? payload.chips : undefined
        const inferred = inferChipsFromAssistantText(finalDisplayText)
        const checkoutCollection = payload?.type === 'chat' && isCheckoutCollectionText(finalDisplayText)
        if (appliedCartAction) {
          setSuggestedChips(getAfterAddToCartChips(uiLang))
        } else if (payload?.type === 'checkout') {
          setSuggestedChips(getAfterCheckoutChips(uiLang))
        } else if (payload?.type === 'order_preview') {
          setSuggestedChips(chipSource ?? [])
        } else if (payload?.type === 'order_tracking') {
          setSuggestedChips(chipSource ?? [])
        } else if (checkoutCollection) {
          setSuggestedChips(chipSource ?? [])
        } else if (payload?.type === 'plan_board' && !(payload as { plan?: PlanBoard }).plan?.occasion) {
          setSuggestedChips(mergeChips(chipSource, getOccasionChips()))
        } else {
          setSuggestedChips(mergeChips(chipSource, inferred))
        }

        const finalMessages: ChatMessage[] = [
          ...history,
          {
            role: 'assistant',
            content: finalDisplayText,
            payload: payload ?? undefined,
            isStreaming: false,
          },
        ]

        setChatMessages(finalMessages)

        if (payload?.type === 'checkout') {
          const snapshot = (payload.cartRestore ?? cartItems).map((i) => ({ ...i }))
          clearCheckedOutCart(snapshot)
          await persistSession({
            messages: finalMessages,
            journeyStep: nextJourney,
            cartSnapshot: useCartStore.getState().items,
          })
        } else {
          await persistSession({ messages: finalMessages, journeyStep: nextJourney })
        }
      } catch (err) {
        const status = (err as { status?: number }).status
        const isTimeout =
          err instanceof DOMException &&
          (err.name === 'TimeoutError' || err.name === 'AbortError')
        const errorText =
          status === 429
            ? messages.errors.rateLimit
            : isTimeout
            ? messages.errors.timeout
            : messages.errors.generic
        lastFailedText.current = text
        setChatMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: errorText,
            isStreaming: false,
          }
          return next
        })
        setSuggestedChips([messages.errors.tryAgain])
      } finally {
        setIsStreaming(false)
        setStatusLines([])
      }
    },
    [
      chatMessages,
      isStreaming,
      uiLang,
      cartItems,
      savedProfiles,
      messages.errors,
      journeyStep,
      persistSession,
      clearCheckedOutCart,
      voiceMuted,
      primeVoice,
    ]
  )

  const handleCheckoutSuccess = useCallback(
    (ctx: CheckoutSuccessPayload) => {
      const snapshot = ctx.cartRestore.map((i) => ({ ...i }))
      clearCheckedOutCart(snapshot)

      const checkoutMsg: ChatMessage = {
        role: 'assistant',
        content:
          'Done - your order is ready for payment. Thank you for choosing Kapruka. Complete the payment link below, and come again anytime; I will help faster next time.',
        payload: {
          type: 'checkout',
          orderResult: ctx.orderResult,
          text: 'Order ready for payment',
          items: ctx.items,
          cartRestore: ctx.cartRestore,
          recipient: ctx.recipient,
          subtotal: ctx.subtotal,
          deliveryFee: ctx.deliveryFee,
          total: ctx.total,
          giftMessage: ctx.giftMessage,
          senderName: ctx.senderName,
          senderEmail: ctx.senderEmail,
          specialInstructions: ctx.specialInstructions,
        },
      }
      setChatMessages((prev) => {
        const marked = prev.map((m) => {
          if (m.payload?.type !== 'plan_board') return m
          return {
            ...m,
            payload: {
              ...m.payload,
              plan: { ...m.payload.plan, confirmed: true },
            },
          }
        })
        const next = [...marked, checkoutMsg]
        void persistSession({
          messages: next,
          journeyStep: 3,
          cartSnapshot: useCartStore.getState().items,
        })
        return next
      })
      setJourneyStep(3)
      setSuggestedChips(getAfterCheckoutChips(uiLang))
    },
    [uiLang, persistSession, clearCheckedOutCart]
  )

  /** Shared checkout-with-retry: fires checkout API, auto-retries once on transient 502 */
  const runCheckoutWithRetry = useCallback(
    async (details: CheckoutDetailsInput, source: string) => {
      const doCall = async () => {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: cartItems,
            recipient: details.recipient,
            senderName: details.senderName,
            senderEmail: details.senderEmail,
            giftMessage: details.giftMessage,
            specialInstructions: details.specialInstructions,
          }),
        })
        const data = await res.json()
        return { res, data }
      }

      let { res, data } = await doCall()
      logCheckoutFailure(source, res, data)

      // Auto-retry once on transient upstream failures
      if (!data.orderResult && (res.status === 502 || data.retryable)) {
        console.log(`[${source}] Retrying checkout after transient failure...`)
        await new Promise((r) => setTimeout(r, 1200))
        const retry = await doCall()
        res = retry.res
        data = retry.data
        logCheckoutFailure(`${source}-retry`, res, data)
      }

      return data
    },
    [cartItems]
  )

  const handlePlanBoardConfirm = useCallback(
    async (data: CheckoutDetailsInput) => {
      if (cartItems.length === 0 || confirmingOrder) return
      setConfirmingOrder(true)
      try {
        const checkout = await runCheckoutWithRetry(data, 'chat-plan-confirm')
        if (checkout.orderResult) {
          const snapshot = cartItems.map((i) => ({ ...i }))
          handleCheckoutSuccess({
            orderResult: checkout.orderResult as OrderResult,
            items: snapshot.map((i) => ({
              id: i.id, name: i.name, price: i.price,
              quantity: i.quantity, image: i.image, url: i.url,
            })),
            cartRestore: snapshot,
            recipient: checkout.recipient,
            subtotal: checkout.subtotal ?? snapshot.reduce((s: number, i: CartItem) => s + i.price * i.quantity, 0),
            deliveryFee: checkout.deliveryFee,
            total: checkout.total ?? snapshot.reduce((s: number, i: CartItem) => s + i.price * i.quantity, 0),
            giftMessage: checkout.giftMessage, senderName: checkout.senderName,
            senderEmail: checkout.senderEmail, specialInstructions: checkout.specialInstructions,
          })
        } else {
          const errMsg: ChatMessage = { role: 'assistant', content: checkoutFailureMessage(checkout) }
          setChatMessages((prev) => {
            const next = [...prev, errMsg]
            void persistSession({ messages: next, journeyStep: 2 })
            return next
          })
          setJourneyStep(2)
          setSuggestedChips([])
        }
      } catch {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: 'A network error occurred. Please try again.' } as ChatMessage])
        setJourneyStep(2)
        setSuggestedChips([])
      } finally {
        setConfirmingOrder(false)
      }
    },
    [cartItems, confirmingOrder, handleCheckoutSuccess, persistSession, runCheckoutWithRetry]
  )

  const handleOrderPreviewConfirm = useCallback(
    async (details: CheckoutDetailsInput) => {
      if (cartItems.length === 0 || confirmingOrder) return
      setConfirmingOrder(true)
      try {
        const data = await runCheckoutWithRetry(details, 'chat-preview-confirm')
        if (data.orderResult) {
          const snapshot = cartItems.map((i) => ({ ...i }))
          handleCheckoutSuccess({
            orderResult: data.orderResult as OrderResult,
            items: snapshot.map((i) => ({
              id: i.id, name: i.name, price: i.price,
              quantity: i.quantity, image: i.image, url: i.url,
            })),
            cartRestore: snapshot,
            recipient: data.recipient,
            subtotal: data.subtotal ?? snapshot.reduce((s: number, i: CartItem) => s + i.price * i.quantity, 0),
            deliveryFee: data.deliveryFee,
            total: data.total ?? snapshot.reduce((s: number, i: CartItem) => s + i.price * i.quantity, 0),
            giftMessage: data.giftMessage, senderName: data.senderName,
            senderEmail: data.senderEmail, specialInstructions: data.specialInstructions,
          })
        } else {
          const errMsg: ChatMessage = { role: 'assistant', content: checkoutFailureMessage(data) }
          setChatMessages((prev) => {
            const next = [...prev, errMsg]
            void persistSession({ messages: next, journeyStep: 2 })
            return next
          })
          setJourneyStep(2)
          setSuggestedChips([])
        }
      } catch {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: 'A network error occurred. Please try again.' } as ChatMessage])
        setJourneyStep(2)
        setSuggestedChips([])
      } finally {
        setConfirmingOrder(false)
      }
    },
    [cartItems, confirmingOrder, handleCheckoutSuccess, persistSession, runCheckoutWithRetry]
  )

  const handleAddToCart = useCallback(
    (product: { id: string; name: string; price: number }) => {
      const followUp: ChatMessage = {
        role: 'assistant',
        content: addToCartFollowUp(product.name, uiLang),
      }
      setChatMessages((prev) => {
        const next = [...prev, followUp]
        void persistSession({ messages: next })
        return next
      })
      setSuggestedChips(getAfterAddToCartChips(uiLang))
    },
    [uiLang, persistSession]
  )

  const handleShowMore = useCallback(() => {
    const prompt =
      uiLang === 'si'
        ? 'මේ වගේ තව වෙනස් options ටිකක් පෙන්නන්න'
        : uiLang === 'ta'
        ? 'இது போன்ற வேறு options காட்டுங்கள்'
        : 'Show me more different options like these'
    void sendMessage(prompt)
  }, [uiLang, sendMessage])

  const handleCheckoutCancel = useCallback(
    (messageIndex: number) => {
      setChatMessages((prev) => {
        const next = prev.map((msg, idx) => {
          if (idx !== messageIndex || msg.payload?.type !== 'checkout') return msg
          return {
            ...msg,
            payload: { ...msg.payload, cancelled: true },
          }
        })
        void persistSession({
          messages: next,
          cartSnapshot: useCartStore.getState().items,
        })
        return next
      })
    },
    [persistSession]
  )

  useEffect(() => {
    if (autoSent.current || chatMessages.length === 0) return
    const q = searchParams.get('q')
    const intent = searchParams.get('intent')
    let auto = q || ''
    if (!auto && intent === 'track') auto = 'Track my order'
    if (auto) {
      autoSent.current = true
      setTimeout(() => sendMessage(auto), 400)
    }
  }, [searchParams, sendMessage, chatMessages.length])

  return (
    <AppShell
      ambient
      collapsibleSidebar
      sidebar={
        <RecentSessionsSidebar
          activeId={sessionId}
          onSelect={(id) => void loadSession(id)}
          onNewChat={() => void startNewChat()}
        />
      }
      onCheckoutViaChat={sendMessage}
      onCheckoutSuccess={handleCheckoutSuccess}
    >
      <div className="chat-layout mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden">
        {/* Messages */}
        <div className="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-4 sm:py-5">
          <WelcomeGuide onPick={sendMessage} disabled={searchParams.get('intent') === 'track' || journeyStep >= 2 || chatMessages.some((m) => isFlowPayload(m.payload))} />
          {chatMessages.map((msg, i) => {
            const isLastStreaming = msg.isStreaming && i === chatMessages.length - 1
            if (isLastStreaming && isStreaming && !msg.content) {
              return (
                <FlowThinking key={i} events={statusLines} fallback={messages.chat.flowOnIt} />
              )
            }

            const hasProductTrio = msg.payload?.type === 'product_trio'

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                className={
                  msg.role === 'user'
                    ? 'flex justify-end pl-8 sm:pl-12'
                    : `flex w-full justify-start ${hasProductTrio ? '' : 'pr-4 sm:pr-8'}`
                }
              >
                {msg.role === 'user' ? (
                  <div className="bubble-user max-w-[min(85%,26rem)]">
                    <p className="whitespace-pre-wrap break-words">
                      {formatCheckoutUserDisplay(msg.content)}
                    </p>
                    <div className="mt-1 flex justify-end">
                      <SentReceipt />
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex w-full items-start gap-2.5 ${
                      hasProductTrio ? 'min-w-0' : 'max-w-[min(100%,34rem)]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <AnuLogoMark size="sm" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      {(msg.content || isLastStreaming) && (
                        <div className="bubble-ai">
                          {msg.content}
                          {isLastStreaming && isStreaming && !statusLines.length && (
                            <span
                              className="ml-1 inline-block h-4 w-[2px] bg-[var(--kap-purple)]"
                              style={{ animation: 'cursorBlink 1s ease-in-out infinite' }}
                            />
                          )}
                        </div>
                      )}
                      {msg.payload?.type === 'product_trio' && (
                        <ProductTrioCard
                          trio={{
                            ...(msg.payload.trio as ProductTrio),
                            context:
                              msg.content &&
                              msg.payload.trio?.context &&
                              msg.content.trim() === msg.payload.trio.context.trim()
                                ? undefined
                                : msg.payload.trio?.context,
                          }}
                          onAddToCart={handleAddToCart}
                          onShowMore={handleShowMore}
                        />
                      )}
                      {msg.payload?.type === 'plan_board' && (
                        <PlanBoardCard
                          plan={msg.payload.plan as PlanBoard}
                          processing={confirmingOrder}
                          onConfirm={handlePlanBoardConfirm}
                        />
                      )}
                      {msg.payload?.type === 'order_preview' && !msg.payload.confirmed && (
                        <OrderConfirmCard
                          items={msg.payload.items}
                          details={msg.payload.details}
                          subtotal={msg.payload.subtotal}
                          deliveryFee={msg.payload.deliveryFee}
                          total={msg.payload.total}
                          deliveryNote={msg.payload.deliveryNote}
                          processing={confirmingOrder}
                          onConfirm={() => {
                            if (msg.payload?.type === 'order_preview') {
                              void handleOrderPreviewConfirm(msg.payload.details)
                            }
                          }}
                        />
                      )}
                      {msg.payload?.type === 'order_tracking' && (
                        <OrderTrackingCard tracking={msg.payload.tracking as OrderTracking} />
                      )}
                      {msg.payload?.type === 'checkout' && (
                        <LockedCheckoutCard
                          orderResult={msg.payload.orderResult}
                          text={msg.payload.text}
                          items={msg.payload.items}
                          cartRestore={msg.payload.cartRestore}
                          recipient={msg.payload.recipient}
                          subtotal={msg.payload.subtotal}
                          deliveryFee={msg.payload.deliveryFee}
                          total={msg.payload.total}
                          giftMessage={msg.payload.giftMessage}
                          senderName={msg.payload.senderName}
                          senderEmail={msg.payload.senderEmail}
                          specialInstructions={msg.payload.specialInstructions}
                          cancelled={msg.payload.cancelled}
                          onCancel={() => handleCheckoutCancel(i)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Suggested chips */}
        {suggestedChips.length > 0 && !isStreaming && (
          <div className="mb-2 flex shrink-0 flex-wrap gap-2 px-3 sm:px-4">
            {suggestedChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() =>
                  sendMessage(
                    chip === messages.errors.tryAgain && lastFailedText.current
                      ? lastFailedText.current
                      : chip
                  )
                }
                className="glass-chip rounded-full px-3.5 py-2 text-sm font-medium text-[var(--text-primary)]"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input dock */}
        <div className="chat-input-dock shrink-0">
          <ProgressInputBar
            value={input}
            onChange={setInput}
            onSubmit={sendMessage}
            placeholder={messages.chat.placeholder}
            uiLang={uiLang}
            speechLang={micLang}
            journeyStep={journeyStep}
            loading={isStreaming}
            docked
          />
        </div>
      </div>
    </AppShell>
  )
}

export function AnuChat() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-kapruka-header border-t-transparent" />
        </div>
      }
    >
      <AnuChatInner />
    </Suspense>
  )
}
