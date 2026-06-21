'use client'

import { Calendar, Gift, MapPin, Package, User } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import type { CheckoutDetailsInput } from '@/types'
import {
  slipBody,
  slipBtnPrimary,
  slipBtnSecondary,
  slipHeader,
  slipSectionIcon,
  slipSectionLabel,
  slipShell,
} from '@/components/chat/slip-styles'

export interface OrderPreviewItem {
  id?: string
  name: string
  price: number
  quantity: number
  image?: string | null
}

interface Props {
  items: OrderPreviewItem[]
  details: CheckoutDetailsInput
  subtotal: number
  deliveryFee: number | null
  total: number | null
  deliveryNote?: string
  processing?: boolean
  onConfirm: () => void
  onEdit?: () => void
}

function formatDate(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function OrderConfirmCard({
  items,
  details,
  subtotal,
  deliveryFee,
  total,
  deliveryNote,
  processing = false,
  onConfirm,
  onEdit,
}: Props) {
  const { messages } = useLanguage()
  const m = messages.confirm

  const resolvedTotal = total ?? (deliveryFee != null ? subtotal + deliveryFee : subtotal)

  return (
    <div className={slipShell}>
      <div className={`bg-gradient-to-r from-[#401F60] to-[#593082] ${slipHeader} text-white`}>
        <h3 className="text-sm font-bold leading-tight">{m.title}</h3>
        <p className="mt-0.5 text-xs leading-snug text-white/75">{m.subtitle}</p>
      </div>

      <div className={`${slipBody} text-xs`}>
        <section>
          <div className={slipSectionLabel}>
            <Package className={slipSectionIcon} />
            {m.items}
          </div>
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id ?? item.name} className="flex justify-between gap-2">
                <span className="text-[var(--text-primary)]">
                  {item.name}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </span>
                <span className="shrink-0 font-semibold">
                  Rs. {(item.price * item.quantity).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-page)] p-2.5">
          <div className={slipSectionLabel}>
            <MapPin className={slipSectionIcon} />
            {m.recipient}
          </div>
          <p className="font-medium text-[var(--text-primary)]">{details.recipient.name}</p>
          <p className="text-[var(--text-muted)]">{details.recipient.phone}</p>
          <p className="mt-0.5 text-[var(--text-primary)]">{details.recipient.address}</p>
          <p className="text-[var(--text-muted)]">{details.recipient.city}</p>
          <div className="mt-1 flex items-center gap-1 text-[var(--text-muted)]">
            <Calendar className="h-3 w-3" />
            {formatDate(details.recipient.date)}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-page)] p-2.5">
          <div className={slipSectionLabel}>
            <User className={slipSectionIcon} />
            {m.sender}
          </div>
          <p className="text-[var(--text-primary)]">{details.senderName}</p>
          <p className="text-[var(--text-muted)]">{details.senderEmail}</p>
        </section>

        {details.giftMessage?.trim() && (
          <div className="flex gap-2 rounded-lg border border-yellow-200/60 bg-[#FFFBEB] p-2 dark:border-yellow-900/30 dark:bg-yellow-900/10">
            <Gift className={`${slipSectionIcon} mt-0.5 shrink-0 text-yellow-600`} />
            <p className="italic text-yellow-900 dark:text-yellow-100/90">
              &ldquo;{details.giftMessage.trim()}&rdquo;
            </p>
          </div>
        )}

        <div className="space-y-0.5 border-t border-[var(--border-light)] pt-2">
          <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
            <span>{m.subtotal}</span>
            <span>Rs. {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
            <span>{m.delivery}</span>
            <span>
              {deliveryFee != null ? `Rs. ${deliveryFee.toLocaleString()}` : m.deliveryPending}
            </span>
          </div>
          <div className="flex justify-between border-t border-[var(--border-light)] pt-1 text-xs font-bold text-[var(--text-primary)]">
            <span>{m.total}</span>
            <span>Rs. {resolvedTotal.toLocaleString()}</span>
          </div>
          {deliveryNote && (
            <p className="text-[10px] text-[var(--text-muted)]">{deliveryNote}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 pt-0.5 sm:flex-row">
          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className={`flex-1 ${slipBtnPrimary}`}
          >
            {processing ? messages.cart.processing : m.confirmPay}
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={processing}
              className={`flex-1 ${slipBtnSecondary}`}
            >
              {m.edit}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
