'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, Trash2, ShoppingBag, CheckSquare, Square } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useLanguage } from '@/providers/LanguageProvider'
import { CheckoutDetailsFields } from '@/components/cart/CheckoutDetailsFields'
import { OrderConfirmCard } from '@/components/cart/OrderConfirmCard'
import type { CheckoutSuccessPayload, CheckoutDetailsInput, OrderResult } from '@/types'


type CheckoutFailureResponse = {
  error?: string
  reason?: string
  details?: string
}

function checkoutFailureMessage(data: CheckoutFailureResponse) {
  return data.error || data.reason || 'Checkout failed. Please try again.'
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
interface Props {
  open: boolean
  onClose: () => void
  onCheckoutViaChat?: (msg: string) => void
  onCheckoutSuccess?: (payload: CheckoutSuccessPayload) => void
}

export function CartDrawer({ open, onClose, onCheckoutSuccess }: Props) {
  const { messages } = useLanguage()
  const {
    items,
    updateQuantity,
    removeItem,
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    selectedItems,
    selectedTotal,
  } = useCartStore()

  const [tab, setTab] = useState<'items' | 'delivery'>('items')
  const [deliveryStep, setDeliveryStep] = useState<'form' | 'confirm'>('form')
  const [pendingDetails, setPendingDetails] = useState<CheckoutDetailsInput | null>(null)
  const [preview, setPreview] = useState<{
    subtotal: number
    deliveryFee: number | null
    total: number | null
    deliveryNote?: string
  } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const checkoutItems = selectedItems()
  const allSelected = items.length > 0 && selectedIds.length === items.length

  const handleToggleAll = () => {
    if (allSelected) clearSelection()
    else selectAll()
  }

  const handleDeliverySubmit = async (details: CheckoutDetailsInput) => {
    if (checkoutItems.length === 0) return
    setProcessing(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: checkoutItems,
          recipient: details.recipient,
          senderName: details.senderName,
          senderEmail: details.senderEmail,
          giftMessage: details.giftMessage,
          specialInstructions: details.specialInstructions,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCheckoutError(data.error ?? 'Could not preview order. Please try again.')
        return
      }
      setPendingDetails(details)
      setPreview({
        subtotal: data.subtotal,
        deliveryFee: data.deliveryFee,
        total: data.total,
        deliveryNote: data.deliveryNote,
      })
      setDeliveryStep('confirm')
    } catch {
      setCheckoutError('A network error occurred. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleConfirmOrder = async () => {
    if (!pendingDetails || checkoutItems.length === 0) return
    setProcessing(true)
    setCheckoutError(null)

    const doCheckout = async (): Promise<{ res: Response; data: CheckoutFailureResponse & { orderResult?: OrderResult; recipient?: Record<string, string>; subtotal?: number; deliveryFee?: number; total?: number; giftMessage?: string; senderName?: string; senderEmail?: string; specialInstructions?: string; retryable?: boolean } }> => {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: checkoutItems,
          recipient: pendingDetails.recipient,
          senderName: pendingDetails.senderName,
          senderEmail: pendingDetails.senderEmail,
          giftMessage: pendingDetails.giftMessage,
          specialInstructions: pendingDetails.specialInstructions,
        }),
      })
      const data = await res.json()
      return { res, data }
    }

    try {
      let { res, data } = await doCheckout()
      logCheckoutFailure('cart-confirm', res, data)

      // Auto-retry once on transient upstream failures
      if (!data.orderResult && (res.status === 502 || data.retryable)) {
        setCheckoutError('Retrying order...')
        await new Promise((r) => setTimeout(r, 1200))
        const retry = await doCheckout()
        res = retry.res
        data = retry.data
        logCheckoutFailure('cart-confirm-retry', res, data)
        setCheckoutError(null)
      }

      if (data.orderResult) {
        const snapshot = checkoutItems.map((i) => ({ ...i }))
        checkoutItems.forEach((i) => removeItem(i.id))

        onCheckoutSuccess?.({
          orderResult: data.orderResult as OrderResult,
          items: snapshot.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            image: i.image,
            url: i.url,
          })),
          cartRestore: snapshot,
          recipient: data.recipient as CheckoutSuccessPayload['recipient'],
          subtotal: data.subtotal ?? snapshot.reduce((s, i) => s + i.price * i.quantity, 0),
          deliveryFee: data.deliveryFee,
          total: data.total ?? snapshot.reduce((s, i) => s + i.price * i.quantity, 0),
          giftMessage: data.giftMessage,
          senderName: data.senderName,
          senderEmail: data.senderEmail,
          specialInstructions: data.specialInstructions,
        })

        setTab('items')
        setDeliveryStep('form')
        setPendingDetails(null)
        setPreview(null)
        onClose()
      } else {
        setCheckoutError(checkoutFailureMessage(data))
      }
    } catch {
      setCheckoutError('A network error occurred. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = () => {
    setDeliveryStep('form')
    setPendingDetails(null)
    setPreview(null)
    setCheckoutError(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close cart"
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[61] flex h-[100dvh] w-[min(100vw,24rem)] flex-col overflow-hidden bg-[var(--bg-surface)] shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-[#401F60] px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-[#FCE22A]" />
                <h2 className="font-display text-lg font-bold tracking-wide">
                  {messages.nav.cart}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex shrink-0 border-b border-[var(--border-light)] bg-[var(--bg-surface)] px-5">
                {(['items', 'delivery'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (t === 'delivery' && checkoutItems.length === 0) return
                      if (t === 'delivery') setDeliveryStep('form')
                      setTab(t)
                    }}
                    className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
                      tab === t
                        ? 'border-b-2 border-[#401F60] text-[#401F60] dark:text-white dark:border-white'
                        : 'text-[var(--text-muted)] hover:text-[#401F60] dark:hover:text-white/80'
                    } ${t === 'delivery' && checkoutItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {t === 'items' ? messages.cart.items : messages.cart.delivery}
                  </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-[var(--bg-page)]">
              {tab === 'items' ? (
                items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#401F60]/5 dark:bg-white/5">
                      <ShoppingBag className="h-10 w-10 text-[#401F60]/40 dark:text-white/40" />
                    </div>
                    <div>
                      <p className="mb-1 font-bold text-[var(--text-primary)]">
                        {messages.cart.emptyTitle}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {messages.cart.emptyHint}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Select All Toggle */}
                    <div className="flex items-center gap-3 pb-2 border-b border-[var(--border-light)] px-1">
                      <button type="button" onClick={handleToggleAll} className="text-[#401F60] dark:text-white">
                        {allSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 opacity-50" />}
                      </button>
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </span>
                    </div>

                    <ul className="space-y-3">
                      {items.map((item) => {
                        const isSelected = selectedIds.includes(item.id)
                        return (
                          <li key={item.id} className={`flex gap-3 rounded-xl border bg-[var(--bg-surface)] p-3 transition-colors ${isSelected ? 'border-[#401F60] shadow-sm dark:border-white/30' : 'border-[var(--border-light)] opacity-75'}`}>
                            <button type="button" onClick={() => toggleSelection(item.id)} className="mt-1 shrink-0 text-[#401F60] dark:text-white">
                              {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 opacity-40" />}
                            </button>
                            
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-kapruka-header/5 dark:bg-white/5 text-2xl overflow-hidden relative">
                              {item.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    e.currentTarget.parentElement?.classList.add('cart-thumb-fallback')
                                  }}
                                />
                              ) : (
                                <span aria-hidden>🎁</span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 flex flex-col justify-between">
                              <div>
                                <p className="truncate text-sm font-bold text-[var(--text-primary)]">{item.name}</p>
                                <p className="text-sm font-semibold text-kapruka-header dark:text-white mt-0.5">
                                  Rs. {item.price.toLocaleString()}
                                </p>
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 bg-[var(--bg-page)] rounded-md border border-[var(--border-light)] p-0.5">
                                  <button
                                    type="button"
                                    aria-label="Decrease quantity"
                                    disabled={item.quantity <= 1}
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 transition">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <button type="button" onClick={() => removeItem(item.id)} className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              ) : (
                <div className="p-5">
                  {deliveryStep === 'confirm' && pendingDetails && preview ? (
                    <OrderConfirmCard
                      items={checkoutItems.map((i) => ({
                        id: i.id,
                        name: i.name,
                        price: i.price,
                        quantity: i.quantity,
                        image: i.image,
                      }))}
                      details={pendingDetails}
                      subtotal={preview.subtotal}
                      deliveryFee={preview.deliveryFee}
                      total={preview.total}
                      deliveryNote={preview.deliveryNote}
                      processing={processing}
                      onConfirm={handleConfirmOrder}
                      onEdit={() => {
                        setDeliveryStep('form')
                        setCheckoutError(null)
                      }}
                    />
                  ) : (
                    <>
                      <div className="mb-6 p-3 rounded-lg bg-[#401F60]/5 dark:bg-white/5 border border-[#401F60]/10 dark:border-white/10">
                        <p className="text-xs font-bold text-[#401F60] dark:text-white/80 uppercase tracking-wider mb-2">Order Summary ({checkoutItems.length} items)</p>
                        <ul className="text-sm space-y-1 text-[var(--text-secondary)]">
                          {checkoutItems.map(i => (
                            <li key={i.id} className="flex justify-between truncate">
                              <span className="truncate pr-2">{i.quantity}x {i.name}</span>
                              <span className="shrink-0 font-medium">Rs. {(i.price * i.quantity).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t border-[#401F60]/10 dark:border-white/10 flex justify-between font-bold text-[#401F60] dark:text-white">
                          <span>Subtotal</span>
                          <span>Rs. {selectedTotal().toLocaleString()}</span>
                        </div>
                      </div>

                      <CheckoutDetailsFields
                        variant="cart"
                        processing={processing}
                        onSubmit={handleDeliverySubmit}
                      />
                    </>
                  )}

                  {checkoutError && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-50 p-4 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400 font-medium">
                      {checkoutError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            {tab === 'items' && items.length > 0 && (
              <div className="border-t border-[var(--border-light)] bg-[var(--bg-surface)] p-5 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="mb-4 flex justify-between text-sm items-end">
                  <span className="font-bold text-[var(--text-secondary)]">Subtotal ({checkoutItems.length} items)</span>
                  <span className="text-xl font-black text-kapruka-header dark:text-white">Rs. {selectedTotal().toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  disabled={checkoutItems.length === 0}
                  onClick={() => setTab('delivery')}
                  className="w-full rounded-full bg-[#FCE22A] py-3.5 text-sm font-bold text-[#401F60] transition-all hover:bg-[#FDEB6B] active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Checkout Selected
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
