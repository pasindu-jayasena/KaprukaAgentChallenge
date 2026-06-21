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
import { OrderTrackingCard } from '@/components/chat/OrderTrackingCard'
import { WelcomeGuide } from '@/components/chat/WelcomeGuide'
import { useLanguage } from '@/providers/LanguageProvider'
import { useCartStore } from '@/store/cartStore'
import { detectChatLanguage } from '@/lib/detect-language'
import { ANU_GREETINGS } from '@/config/site'
import type {
  ChatMessage,
  ChatPayload,
  Recipient,
  ProductTrio,
  PlanBoard,
  OrderTracking,
  OrderResult,
  StatusEvent,
  SessionRecord,
} from '@/types'

function getGreeting(uiLang: string): string {
  if (uiLang === 'si') return ANU_GREETINGS.si
  if (uiLang === 'ta') return ANU_GREETINGS.ta
  return ANU_GREETINGS.en
}

function AnuChatInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { messages, uiLang } = useLanguage()
  const cartItems = useCartStore((s) => s.items)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [statusLines, setStatusLines] = useState<StatusEvent[]>([])
  const [journeyStep, setJourneyStep] = useState(0)
  const [suggestedChips, setSuggestedChips] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoSent = useRef(false)
  const loaded = useRef(false)
  const pendingSession = useRef<string | null>(null)

  const persistSession = useCallback(
    async (patch: Partial<SessionRecord> & { messages?: ChatMessage[] }) => {
      if (!sessionId) return
      const lastUser = [...(patch.messages ?? chatMessages)]
        .reverse()
        .find((m) => m.role === 'user')
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patch,
          preview: lastUser?.content?.slice(0, 80) ?? '',
          productCount: cartItems.reduce((n, i) => n + i.quantity, 0),
          cartSnapshot: cartItems,
        }),
      })
    },
    [sessionId, chatMessages, cartItems]
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
      
      // Restore the cart state for this specific chat session to prevent "mixing" orders
      if (session.cartSnapshot) {
        useCartStore.setState({ items: session.cartSnapshot })
      } else {
        useCartStore.setState({ items: [] })
      }

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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const detected = detectChatLanguage(text)
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

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
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
          }),
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let payload: ChatPayload | null = null
        let displayText = ''
        let nextJourney = journeyStep

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
                else if (payload.type === 'product_trio')
                  displayText =
                    (payload as { trio?: ProductTrio }).trio?.context ?? 'Here are my top picks:'
                else displayText = 'Got it!'
                if ('orderResult' in evt.payload && evt.payload.orderResult) {
                  payload = {
                    type: 'checkout',
                    orderResult: evt.payload.orderResult as OrderResult,
                    text: displayText,
                  }
                }
              }
            } catch {
              /* skip */
            }
          }
        }

        if (payload?.type === 'product_trio') nextJourney = 1
        if (payload?.type === 'plan_board') nextJourney = 2
        if (payload?.type === 'checkout') nextJourney = 3
        if (payload?.type === 'order_tracking') nextJourney = 4
        setJourneyStep(nextJourney)

        if (payload?.type === 'chat' && payload.chips) {
          setSuggestedChips(payload.chips)
        }

        const finalMessages: ChatMessage[] = [
          ...history,
          {
            role: 'assistant',
            content: displayText,
            payload: payload ?? undefined,
            isStreaming: false,
          },
        ]

        setChatMessages(finalMessages)
        await persistSession({ messages: finalMessages, journeyStep: nextJourney })
      } catch {
        setChatMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: messages.errors.generic,
            isStreaming: false,
          }
          return next
        })
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
      messages.errors.generic,
      journeyStep,
      persistSession,
    ]
  )

  const handleRecipientSubmit = (r: Recipient) => {
    const cartSummary = cartItems.map(i => `${i.name} × ${i.quantity} = Rs. ${i.price * i.quantity}`).join(', ')
    sendMessage(
      `CHECKOUT_DETAILS: Cart: [${cartSummary}]; Recipient: Name=${r.name}; Phone=${r.phone}; Address=${r.address}; City=${r.city}; Date=${r.date}`
    )
  }

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
      variant="chat"
      collapsibleSidebar
      sidebar={
        <RecentSessionsSidebar
          activeId={sessionId}
          onSelect={(id) => void loadSession(id)}
          onNewChat={() => void startNewChat()}
        />
      }
      onCheckoutViaChat={sendMessage}
    >
      <div className="chat-layout mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden">
        {/* Messages */}
        <div className="chat-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-4 sm:py-5">
          <WelcomeGuide />
          {chatMessages.map((msg, i) => {
            const isLastStreaming = msg.isStreaming && i === chatMessages.length - 1
            if (isLastStreaming && isStreaming && !msg.content && statusLines.length > 0) {
              return (
                <FlowThinking key={i} events={statusLines} fallback={messages.chat.flowOnIt} />
              )
            }

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                className={msg.role === 'user' ? 'flex justify-end pl-8 sm:pl-12' : 'flex justify-start pr-4 sm:pr-8'}
              >
                {msg.role === 'user' ? (
                  <div className="bubble-user max-w-[min(85%,26rem)]">
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className="mt-1 flex justify-end">
                      <SentReceipt />
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full max-w-[min(100%,34rem)] items-start gap-2.5">
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
                        <ProductTrioCard trio={msg.payload.trio as ProductTrio} />
                      )}
                      {msg.payload?.type === 'plan_board' && (
                        <PlanBoardCard
                          plan={msg.payload.plan as PlanBoard}
                          onRecipientSubmit={handleRecipientSubmit}
                        />
                      )}
                      {msg.payload?.type === 'order_tracking' && (
                        <OrderTrackingCard tracking={msg.payload.tracking as OrderTracking} />
                      )}
                      {msg.payload?.type === 'checkout' && (
                        <LockedCheckoutCard
                          orderResult={msg.payload.orderResult}
                          text={msg.payload.text}
                          items={(msg.payload as any).items}
                          recipient={(msg.payload as any).recipient}
                          subtotal={(msg.payload as any).subtotal}
                          deliveryFee={(msg.payload as any).deliveryFee}
                          total={(msg.payload as any).total}
                          giftMessage={(msg.payload as any).giftMessage}
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
                onClick={() => sendMessage(chip)}
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
