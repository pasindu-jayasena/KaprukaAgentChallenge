'use client'

import { useState } from 'react'
import { Calendar, Gift, MapPin, Package, Sparkles, User } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import { formatCurrency, formatLocaleDate } from '@/lib/i18n/format'
import type { PlanBoard, CheckoutDetailsInput } from '@/types'
import { CheckoutDetailsFields } from '@/components/cart/CheckoutDetailsFields'
import { planHasCompleteRecipient, planToCheckoutDetails } from '@/lib/plan-checkout'
import {
  slipBody,
  slipBtnPrimary,
  slipBtnSecondary,
  slipHeader,
  slipSectionIcon,
  slipSectionLabel,
  slipShell,
} from '@/components/chat/slip-styles'

interface Props {
  plan: PlanBoard
  onConfirm: (data: CheckoutDetailsInput) => void
  processing?: boolean
}

function formatDate(date: string, lang: 'en' | 'si' | 'ta'): string {
  return formatLocaleDate(date, lang)
}

export function PlanBoardCard({ plan, onConfirm, processing = false }: Props) {
  const { messages, uiLang, format } = useLanguage()
  const m = messages.confirm

  const itemTotal =
    plan.subtotal ??
    plan.items?.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0) ??
    0
  const deliveryFee = plan.delivery_fee ?? plan.delivery?.fee ?? 0
  const total = plan.total ?? itemTotal + deliveryFee

  const completeOnLoad = plan.needs_recipient === false && planHasCompleteRecipient(plan)
  const [step, setStep] = useState<'form' | 'review'>(completeOnLoad ? 'review' : 'form')
  const [details, setDetails] = useState<CheckoutDetailsInput | null>(
    completeOnLoad ? planToCheckoutDetails(plan) : null
  )

  const review = details ?? planToCheckoutDetails(plan)
  const confirmed = plan.confirmed === true

  const handleFormSubmit = (data: CheckoutDetailsInput) => {
    setDetails(data)
    setStep('review')
  }

  const handleConfirm = () => {
    onConfirm(review)
  }

  return (
    <div className={slipShell}>
      <div className={`relative overflow-hidden bg-gradient-to-r from-[#401F60] to-[#593082] ${slipHeader} text-white`}>
        <div className="relative z-10 flex items-center gap-1.5">
          <Sparkles className={`${slipSectionIcon} shrink-0 text-[#FCE22A]`} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              Your gift plan
            </p>
            <h3 className="truncate text-sm font-bold leading-tight">
              {plan.occasion || 'Gift package'}
            </h3>
          </div>
        </div>
        {plan.message && (
          <p className="relative z-10 mt-1 text-xs leading-snug text-white/80">{plan.message}</p>
        )}
      </div>

      <div className={`${slipBody} text-xs`}>
        {plan.items && plan.items.length > 0 && (
          <section>
            <div className={slipSectionLabel}>
              <Package className={slipSectionIcon} />
              {m.items}
            </div>
            <ul className="space-y-1">
              {plan.items.map((item, index) => {
                const qty = item.quantity || 1
                const price = item.price || 0
                return (
                  <li
                    key={item.product_id || item.name || index}
                    className="flex items-start justify-between gap-2 text-xs"
                  >
                    <span className="text-[var(--text-primary)]">
                      {item.name}
                      {qty > 1 ? ` × ${qty}` : ''}
                    </span>
                    <span className="shrink-0 font-semibold text-kapruka-header dark:text-[var(--text-primary)]">
                      {price > 0 ? formatCurrency(price * qty, uiLang) : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {step === 'review' && (
          <section className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-page)] p-2.5 text-xs">
            <div className={slipSectionLabel}>
              <MapPin className={slipSectionIcon} />
              {m.recipient}
            </div>
            {review.recipient.name && (
              <p className="font-medium text-[var(--text-primary)]">{review.recipient.name}</p>
            )}
            {review.recipient.phone && (
              <p className="text-[var(--text-muted)]">{review.recipient.phone}</p>
            )}
            {review.recipient.address && (
              <p className="mt-1 text-[var(--text-primary)]">{review.recipient.address}</p>
            )}
            {review.recipient.city && (
              <p className="text-[var(--text-muted)]">{review.recipient.city}</p>
            )}
            {review.recipient.date && (
              <div className="mt-2 flex items-center gap-1.5 text-[var(--text-muted)]">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(review.recipient.date, uiLang)}
              </div>
            )}
          </section>
        )}

        {step === 'review' && review.senderName && (
          <section className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-page)] p-2.5 text-xs">
            <div className={slipSectionLabel}>
              <User className={slipSectionIcon} />
              {m.sender}
            </div>
            <p className="text-[var(--text-primary)]">{review.senderName}</p>
          </section>
        )}

        {step === 'form' && plan.delivery && (
          <>
            <div className="h-px bg-[var(--border-light)]" />
            <section className="text-xs">
              <div className={slipSectionLabel}>
                <MapPin className={slipSectionIcon} />
                Delivery
              </div>
              <p className="text-[var(--text-primary)]">{plan.delivery.city}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[var(--text-muted)]">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(plan.delivery.date, uiLang)}
                {deliveryFee > 0 && ` · Rs. ${deliveryFee.toLocaleString()} fee`}
              </div>
            </section>
          </>
        )}

        {(review.giftMessage?.trim() || plan.gift_message) && (
          <div className="flex gap-2 rounded-lg border border-yellow-200/60 bg-[#FFFBEB] p-2 text-xs dark:border-yellow-900/30 dark:bg-yellow-900/10">
            <Gift className={`${slipSectionIcon} mt-0.5 shrink-0 text-yellow-600`} />
            <p className="italic text-yellow-900 dark:text-yellow-100/90">
              &ldquo;{review.giftMessage?.trim() || plan.gift_message}&rdquo;
            </p>
          </div>
        )}

        <div className="space-y-0.5 border-t border-[var(--border-light)] pt-2">
          <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
            <span>{m.subtotal}</span>
            <span>{formatCurrency(itemTotal, uiLang)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
            <span>{m.delivery}</span>
            <span>
              {deliveryFee > 0 ? formatCurrency(deliveryFee, uiLang) : m.deliveryPending}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-1">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{m.total}</span>
            <span className="text-sm font-bold text-kapruka-header dark:text-[var(--text-primary)]">
              {formatCurrency(total, uiLang)}
            </span>
          </div>
        </div>

        {step === 'form' && !confirmed && (
          <CheckoutDetailsFields
            variant="chat"
            processing={processing}
            initialSenderName={plan.sender_name ?? ''}
            initialGiftMessage={plan.gift_message ?? ''}
            onSubmit={handleFormSubmit}
          />
        )}

        {step === 'review' && !confirmed && (
          <div className="space-y-2 border-t border-[var(--border-light)] pt-2.5">
            <p className="text-center text-[11px] font-medium text-[var(--text-primary)]">
              {review.recipient.name
                ? format(m.savedRecipientPrompt, { name: review.recipient.name })
                : m.prompt}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={processing}
                className={`flex-1 ${slipBtnPrimary}`}
              >
                {processing ? messages.cart.processing : m.confirmPay}
              </button>
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={processing}
                className={`flex-1 ${slipBtnSecondary}`}
              >
                {m.edit}
              </button>
            </div>
          </div>
        )}

        {confirmed && (
          <p className="text-center text-[10px] font-medium text-[var(--text-muted)]">
            {m.confirmed}
          </p>
        )}
      </div>
    </div>
  )
}
