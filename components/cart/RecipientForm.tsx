'use client'

import { useState } from 'react'
import { useLanguage } from '@/providers/LanguageProvider'
import { useRecipientStore } from '@/store/recipientStore'
import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'
import type { Recipient } from '@/types'

interface Props {
  onSubmit: (r: Recipient) => void
  onViaAnu?: (r: Recipient) => void
  variant?: 'chat' | 'cart'
  processing?: boolean
}

export function RecipientForm({
  onSubmit,
  onViaAnu,
  variant = 'chat',
  processing = false,
}: Props) {
  const { messages } = useLanguage()
  const latest = useRecipientStore((s) => s.getLatestProfile())
  const saveProfile = useRecipientStore((s) => s.saveProfile)

  const [form, setForm] = useState<Recipient>(
    latest?.recipient ?? {
      name: '',
      phone: '',
      address: '',
      city: '',
      date: new Date().toISOString().slice(0, 10),
    }
  )

  const useSaved = () => {
    if (latest?.recipient) {
      setForm(latest.recipient)
      onSubmit(latest.recipient)
    }
  }

  const persistPartial = (recipient: Recipient) => {
    saveProfile({
      recipient,
      senderName: latest?.senderName ?? '',
      senderEmail: latest?.senderEmail ?? DEFAULT_SENDER_EMAIL,
      giftMessage: latest?.giftMessage,
      specialInstructions: latest?.specialInstructions,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    persistPartial(form)
    onSubmit(form)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-2 ${variant === 'chat' ? 'mt-3 rounded-xl border border-kapruka-header/20 bg-purple-50/50 p-3 dark:bg-kapruka-header/10' : ''}`}
    >
      {variant === 'chat' && (
        <p className="text-xs font-semibold text-kapruka-header">{messages.form.recipient}</p>
      )}
      {latest && (
        <button type="button" onClick={useSaved} className="text-xs text-kapruka-header underline">
          {messages.chat.sameAddress}
        </button>
      )}
      <input
        required
        placeholder={messages.form.name}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2 text-sm outline-none focus:border-kapruka-header"
      />
      <input
        required
        placeholder={messages.form.phone}
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="w-full rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2 text-sm outline-none focus:border-kapruka-header"
      />
      <input
        required
        placeholder={messages.form.address}
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="w-full rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2 text-sm outline-none focus:border-kapruka-header"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          placeholder={messages.form.city}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2 text-sm outline-none focus:border-kapruka-header"
        />
        <input
          required
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2 text-sm outline-none focus:border-kapruka-header"
        />
      </div>
      <button
        type="submit"
        disabled={processing}
        className="w-full rounded-xl bg-kapruka-header py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {processing ? messages.cart.processing : messages.cart.checkoutNow}
      </button>
      {onViaAnu && (
        <button
          type="button"
          disabled={processing}
          onClick={() => {
            persistPartial(form)
            onViaAnu(form)
          }}
          className="w-full rounded-xl border border-kapruka-header py-2 text-sm font-medium text-kapruka-header"
        >
          {messages.cart.checkoutViaAnu}
        </button>
      )}
    </form>
  )
}
