'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, CheckCircle2, RotateCcw } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import { useCartStore } from '@/store/cartStore'
import type { CartItem, OrderResult } from '@/types'

interface Props {
  orderResult: OrderResult
  text?: string
  items?: Array<{ id?: string; name: string; price: number; quantity: number; image?: string | null; url?: string | null }>
  cartRestore?: CartItem[]
  recipient?: { name: string; phone: string; city: string; address: string; date: string }
  senderName?: string
  senderEmail?: string
  specialInstructions?: string
  subtotal?: number
  deliveryFee?: number
  total?: number
  giftMessage?: string
  onCancel?: () => void
  cancelled?: boolean
}

function formatDeliveryDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    .toUpperCase()
    .replace(/ /g, ' / ')
}

export function LockedCheckoutCard({
  orderResult,
  text,
  items,
  cartRestore,
  recipient,
  senderName,
  senderEmail,
  specialInstructions,
  subtotal,
  deliveryFee,
  total,
  giftMessage,
  onCancel,
  cancelled = false,
}: Props) {
  const { messages } = useLanguage()
  const restoreCart = useCartStore((s) => s.restoreCart)
  const [secondsLeft, setSecondsLeft] = useState(3600)
  const [copied, setCopied] = useState(false)

  const r = messages.receipt
  const notSpecified = r.notSpecified

  useEffect(() => {
    if (!orderResult.expiresAt) return
    const exp = new Date(orderResult.expiresAt).getTime()
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((exp - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [orderResult.expiresAt])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  const copyRef = () => {
    if (orderResult.ref) {
      navigator.clipboard.writeText(orderResult.ref)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const restoreToCart = () => {
    const restore = cartRestore?.length
      ? cartRestore
      : (items ?? []).map((i, idx) => ({
          id: i.id ?? `restore-${idx}`,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image ?? null,
          url: i.url ?? null,
        }))

    restoreCart(restore)
    onCancel?.()
  }

  const detailRows: Array<{ label: string; value: string }> = []

  if (items?.length) {
    detailRows.push({
      label: r.orderItems,
      value: items.map((i) => `${i.name}${i.id ? `-${i.id}` : ''}`).join('\n'),
    })
  }
  if (recipient) {
    detailRows.push(
      { label: r.recipientName, value: recipient.name },
      { label: r.recipientAddress, value: recipient.address },
      { label: r.recipientCity, value: recipient.city },
      {
        label: r.specialInstructions,
        value: specialInstructions?.trim() || notSpecified,
      },
      { label: r.recipientPhone, value: recipient.phone },
      { label: r.deliveryDate, value: formatDeliveryDate(recipient.date) }
    )
  }
  if (senderName) {
    detailRows.push({ label: r.senderName, value: senderName })
  }
  if (senderEmail) {
    detailRows.push({ label: r.senderEmail, value: senderEmail })
  }
  detailRows.push({
    label: r.personalMessage,
    value: giftMessage?.trim() || notSpecified,
  })

  return (
    <div
      className={`w-full max-w-sm overflow-hidden rounded-2xl border bg-[var(--bg-surface)] shadow-lg transition-opacity ${
        cancelled ? 'border-[var(--border-light)] opacity-75' : 'border-[var(--border-light)]'
      }`}
    >
      <div
        className={`relative overflow-hidden bg-gradient-to-r from-[#401F60] to-[#593082] p-5 text-white ${
          cancelled ? 'opacity-60' : ''
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 mb-2 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-[#FCE22A]" />
          <h3 className="font-display text-xl font-bold">
            {cancelled ? 'Order cancelled' : 'Order locked!'}
          </h3>
        </div>
        {text && (
          <p className={`relative z-10 text-sm ${cancelled ? 'line-through text-white/60' : 'text-white/80'}`}>
            {text}
          </p>
        )}
        {orderResult.ref && (
          <div className="relative z-10 mt-2 flex w-fit items-center gap-2 rounded-lg bg-black/20 p-2">
            <span className="font-mono text-sm text-white/90">Ref: {orderResult.ref}</span>
            <button
              type="button"
              onClick={copyRef}
              className="rounded p-1 transition-colors hover:bg-white/10"
              title="Copy Reference"
            >
              <Copy className="h-3.5 w-3.5 text-white/70" />
            </button>
            {copied && <span className="ml-1 text-xs text-[#FCE22A]">Copied!</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-page)] p-4 text-sm">
          {detailRows.map((row) => (
            <div key={row.label} className="border-b border-[var(--border-light)] py-2.5 last:border-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {row.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap font-medium text-[var(--text-primary)]">
                {row.value}
              </p>
            </div>
          ))}
        </div>

        {(subtotal != null || deliveryFee != null || total != null) && (
          <div className="space-y-1.5 text-sm">
            {subtotal != null && (
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString()}</span>
              </div>
            )}
            {deliveryFee != null && deliveryFee > 0 && (
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Delivery</span>
                <span>Rs. {deliveryFee.toLocaleString()}</span>
              </div>
            )}
            {total != null && (
              <div className="mt-1 flex justify-between border-t border-[var(--border-light)] pt-1 font-bold text-[var(--text-primary)]">
                <span>Total</span>
                <span>Rs. {total.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {orderResult.url && !cancelled && (
          <div className="mt-1 text-center">
            <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
              Expires in{' '}
              <span className="font-bold tabular-nums text-[#401F60] dark:text-[#FCE22A]">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </p>
            <a
              href={orderResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FCE22A] px-4 py-3.5 font-bold text-[#401F60] shadow-sm transition-all hover:bg-[#FDEB6B] hover:shadow-md active:scale-[0.98]"
            >
              💳 Pay now on Kapruka.com
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        {!cancelled && (cartRestore?.length || items?.length) ? (
          <button
            type="button"
            onClick={restoreToCart}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border-light)] py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-page)]"
          >
            <RotateCcw className="h-4 w-4" />
            Cancel & return to cart
          </button>
        ) : null}

        {cancelled && (
          <p className="text-center text-xs text-[var(--text-muted)]">
            Items restored to your cart. You can edit and checkout again.
          </p>
        )}
      </div>
    </div>
  )
}
