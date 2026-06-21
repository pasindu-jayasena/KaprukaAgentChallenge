'use client'

import type { PlanBoard } from '@/types'
import { RecipientForm } from '@/components/cart/RecipientForm'
import type { Recipient } from '@/types'

interface Props {
  plan: PlanBoard
  onRecipientSubmit: (r: Recipient) => void
}

export function PlanBoardCard({ plan, onRecipientSubmit }: Props) {
  return (
    <div className="rounded-xl border border-kapruka-header/20 bg-[var(--bg-surface)] p-4 shadow-sm">
      {plan.occasion && (
        <p className="text-sm font-semibold text-kapruka-header">{plan.occasion}</p>
      )}
      {plan.message && <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.message}</p>}

      <ul className="mt-3 space-y-2">
        {plan.items?.map((item, index) => {
          const qty = item.quantity || 1
          const price = item.price || 0
          return (
            <li key={item.product_id || item.name || index} className="flex justify-between text-sm">
              <span>
                {item.name} {qty > 1 ? `× ${qty}` : ''}
              </span>
              <span className="font-medium">
                {price > 0 ? `Rs. ${(price * qty).toLocaleString()}` : ''}
              </span>
            </li>
          )
        })}
      </ul>

      {plan.delivery && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          📍 {plan.delivery.city} · {plan.delivery.date}
          {plan.delivery.fee != null && ` · Rs. ${plan.delivery.fee}`}
        </p>
      )}

      {plan.gift_message && (
        <p className="mt-2 rounded-lg bg-[#FCE22A]/10 p-2 text-xs italic text-[var(--text-primary)]">
          🎁 {plan.gift_message}
        </p>
      )}

      {plan.total != null && (
        <p className="mt-3 text-right font-bold text-kapruka-header">
          Total: Rs. {plan.total.toLocaleString()}
        </p>
      )}

      {plan.needs_recipient !== false && (
        <RecipientForm onSubmit={onRecipientSubmit} />
      )}
    </div>
  )
}
