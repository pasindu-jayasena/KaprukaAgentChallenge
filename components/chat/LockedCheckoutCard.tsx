'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, CheckCircle2, RotateCcw } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import { useCartStore } from '@/store/cartStore'
import type { CartItem, OrderResult } from '@/types'
import { resolveReceiptTotals } from '@/lib/parse-order-result'
import {
  slipBody,
  slipBtnPrimary,
  slipBtnSecondary,
  slipHeader,
  slipInset,
  slipRowLabel,
  slipRowValue,
  slipShell,
} from '@/components/chat/slip-styles'

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
  const addItem = useCartStore((s) => s.addItem)
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

    // Merge the cancelled order's items back into the global cart instead of
    // replacing it — the customer may have added other products since.
    for (const item of restore) {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image ?? null,
        url: item.url ?? null,
        quantity: item.quantity,
      })
    }
    onCancel?.()
  }

  const detailRows: Array<{ label: string; value: string }> = []

  if (items?.length) {
    detailRows.push({
      label: r.orderItems,
      value: items.map((i) => `${i.name} × ${i.quantity}`).join('\n'),
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
  if (giftMessage?.trim()) {
    detailRows.push({
      label: r.personalMessage,
      value: giftMessage.trim(),
    })
  }

  const pricing = resolveReceiptTotals({
    orderResult,
    subtotal,
    deliveryFee,
    total,
    items,
  })

  return (
    <div
      className={`${slipShell} transition-opacity ${
        cancelled ? 'opacity-75' : ''
      }`}
    >
      <div
        className={`relative overflow-hidden bg-gradient-to-r from-[#401F60] to-[#593082] ${slipHeader} text-white ${
          cancelled ? 'opacity-60' : ''
        }`}
      >
        <div className="relative z-10 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FCE22A]" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight">
              {cancelled ? r.orderCancelled : r.orderLocked}
            </h3>
            {text && (
              <p className={`text-xs leading-snug ${cancelled ? 'line-through text-white/60' : 'text-white/75'}`}>
                {text}
              </p>
            )}
          </div>
        </div>
        {orderResult.ref && (
          <div className="relative z-10 mt-1.5 flex w-full items-center gap-1.5 rounded-md bg-black/20 px-2 py-1">
            <span className="min-w-0 truncate font-mono text-[10px] text-white/90">
              Ref: {orderResult.ref}
            </span>
            <button
              type="button"
              onClick={copyRef}
              className="shrink-0 rounded p-0.5 transition-colors hover:bg-white/10"
              title={r.copyReference}
              aria-label={r.copyReference}
            >
              <Copy className="h-3 w-3 text-white/70" />
            </button>
            {copied && <span className="shrink-0 text-[10px] text-[#FCE22A]">{r.copied}</span>}
          </div>
        )}
      </div>

      <div className={`flex flex-col ${slipBody}`}>
        <div className={`${slipInset} text-xs`}>
          {detailRows.map((row) => (
            <div key={row.label} className="border-b border-[var(--border-light)] py-1.5 last:border-0">
              <p className={slipRowLabel}>{row.label}</p>
              <p className={`${slipRowValue} whitespace-pre-wrap`}>{row.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>{r.subtotal}</span>
            <span>Rs. {pricing.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>{r.delivery}</span>
            <span>Rs. {pricing.deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--border-light)] pt-1 text-xs font-bold text-[var(--text-primary)]">
            <span>{r.total}</span>
            <span>Rs. {pricing.total.toLocaleString()}</span>
          </div>
        </div>

        {orderResult.url && !cancelled && (
          <div className="text-center">
            <p className="mb-1.5 text-[10px] font-medium text-[var(--text-muted)]">
              {r.expiresIn}{' '}
              <span className="font-bold tabular-nums text-[#401F60] dark:text-[#FCE22A]">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </p>
            <a
              href={orderResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex w-full items-center justify-center gap-1.5 ${slipBtnPrimary} active:scale-[0.98]`}
            >
              {r.payOnKapruka}
              <ExternalLink className="h-3 w-3" />
            </a>
            <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
              {messages.confirm.thankYou}
            </p>
          </div>
        )}

        {!cancelled && (cartRestore?.length || items?.length) ? (
          <button
            type="button"
            onClick={restoreToCart}
            className={`flex w-full items-center justify-center gap-1.5 ${slipBtnSecondary}`}
          >
            <RotateCcw className="h-3 w-3" />
            {r.cancelReturnToCart}
          </button>
        ) : null}

        {cancelled && (
          <p className="text-center text-[10px] text-[var(--text-muted)]">
            {r.itemsRestored}
          </p>
        )}
      </div>
    </div>
  )
}
