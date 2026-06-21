'use client'

import { Calendar, Gift, MapPin, Package, Sparkles } from 'lucide-react'
import type { PlanBoard } from '@/types'
import type { CheckoutDetailsInput } from '@/types'
import { CheckoutDetailsFields } from '@/components/cart/CheckoutDetailsFields'

interface Props {
  plan: PlanBoard
  onCheckoutSubmit: (data: CheckoutDetailsInput) => void
}

export function PlanBoardCard({ plan, onCheckoutSubmit }: Props) {
  const itemTotal =
    plan.items?.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0) ?? 0
  const deliveryFee = plan.delivery_fee ?? plan.delivery?.fee ?? 0
  const total = plan.total ?? itemTotal + deliveryFee

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-surface)] shadow-lg">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#401F60] to-[#593082] px-5 py-4 text-white">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#FCE22A]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Your gift plan
            </p>
            <h3 className="font-display text-lg font-bold">
              {plan.occasion || 'Gift package'}
            </h3>
          </div>
        </div>
        {plan.message && (
          <p className="relative z-10 mt-2 text-sm text-white/85">{plan.message}</p>
        )}
      </div>

      <div className="space-y-4 p-5">
        {plan.items && plan.items.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
              <Package className="h-4 w-4" />
              Items
            </div>
            <ul className="space-y-2">
              {plan.items.map((item, index) => {
                const qty = item.quantity || 1
                const price = item.price || 0
                return (
                  <li
                    key={item.product_id || item.name || index}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="text-[var(--text-primary)]">
                      {item.name}
                      {qty > 1 ? ` × ${qty}` : ''}
                    </span>
                    <span className="shrink-0 font-semibold text-kapruka-header dark:text-[var(--text-primary)]">
                      {price > 0 ? `Rs. ${(price * qty).toLocaleString()}` : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {plan.delivery && (
          <>
            <div className="h-px bg-[var(--border-light)]" />
            <section className="text-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
                <MapPin className="h-4 w-4" />
                Delivery
              </div>
              <p className="text-[var(--text-primary)]">{plan.delivery.city}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[var(--text-muted)]">
                <Calendar className="h-3.5 w-3.5" />
                {plan.delivery.date}
                {deliveryFee > 0 && ` · Rs. ${deliveryFee.toLocaleString()} fee`}
              </div>
            </section>
          </>
        )}

        {plan.gift_message && (
          <div className="flex gap-2.5 rounded-xl border border-yellow-200/60 bg-[#FFFBEB] p-3 text-sm dark:border-yellow-900/30 dark:bg-yellow-900/10">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
            <p className="italic text-yellow-900 dark:text-yellow-100/90">
              &ldquo;{plan.gift_message}&rdquo;
            </p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-3">
          <span className="text-sm font-semibold text-[var(--text-secondary)]">Total</span>
          <span className="text-lg font-bold text-kapruka-header dark:text-[var(--text-primary)]">
            Rs. {total.toLocaleString()}
          </span>
        </div>

        {plan.needs_recipient !== false && (
          <CheckoutDetailsFields
            variant="chat"
            initialSenderName={plan.sender_name ?? ''}
            initialGiftMessage={plan.gift_message ?? ''}
            onSubmit={onCheckoutSubmit}
          />
        )}
      </div>
    </div>
  )
}
