'use client'

import { useState } from 'react'
import { Gift } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import { useRecipientStore } from '@/store/recipientStore'
import { DEFAULT_SENDER_EMAIL } from '@/lib/checkout-profile'
import type { CheckoutDetailsInput, Recipient, SavedCheckoutProfile } from '@/types'

type Step = 'recipient-name' | 'confirm-saved' | 'full-form'

interface Props {
  onSubmit: (data: CheckoutDetailsInput) => void
  processing?: boolean
  variant?: 'chat' | 'cart'
  initialSenderName?: string
  initialGiftMessage?: string
}

function profileToForm(profile: SavedCheckoutProfile): CheckoutDetailsInput {
  return {
    senderName: profile.senderName,
    senderEmail: profile.senderEmail,
    giftMessage: profile.giftMessage,
    specialInstructions: profile.specialInstructions,
    recipient: {
      ...profile.recipient,
      date: new Date().toISOString().slice(0, 10),
    },
  }
}

function emptyForm(
  latest: SavedCheckoutProfile | undefined,
  initialSenderName: string,
  initialGiftMessage: string,
  recipientName = ''
): CheckoutDetailsInput {
  return {
    senderName: latest?.senderName || initialSenderName,
    senderEmail: latest?.senderEmail || DEFAULT_SENDER_EMAIL,
    giftMessage: initialGiftMessage || undefined,
    specialInstructions: undefined,
    recipient: {
      name: recipientName,
      phone: '',
      address: '',
      city: '',
      date: new Date().toISOString().slice(0, 10),
    },
  }
}

export function CheckoutDetailsFields({
  onSubmit,
  processing = false,
  variant = 'cart',
  initialSenderName = '',
  initialGiftMessage = '',
}: Props) {
  const { messages } = useLanguage()
  const profiles = useRecipientStore((s) => s.profiles)
  const saveProfile = useRecipientStore((s) => s.saveProfile)
  const findByRecipientName = useRecipientStore((s) => s.findByRecipientName)
  const getLatestProfile = useRecipientStore((s) => s.getLatestProfile)

  const [step, setStep] = useState<Step>(profiles.length > 0 ? 'recipient-name' : 'full-form')
  const [recipientNameInput, setRecipientNameInput] = useState('')
  const [matchedProfile, setMatchedProfile] = useState<SavedCheckoutProfile | null>(null)
  const [form, setForm] = useState<CheckoutDetailsInput>(() =>
    emptyForm(getLatestProfile(), initialSenderName, initialGiftMessage)
  )

  const updateRecipient = (patch: Partial<Recipient>) => {
    setForm((prev) => ({ ...prev, recipient: { ...prev.recipient, ...patch } }))
  }

  const handleNameContinue = (e: React.FormEvent) => {
    e.preventDefault()
    const name = recipientNameInput.trim()
    if (!name) return

    const match = findByRecipientName(name)
    if (match) {
      setMatchedProfile(match)
      setStep('confirm-saved')
    } else {
      setForm(emptyForm(getLatestProfile(), initialSenderName, initialGiftMessage, name))
      setStep('full-form')
    }
  }

  const confirmSaved = () => {
    if (!matchedProfile) return
    setForm(profileToForm(matchedProfile))
    setStep('full-form')
  }

  const rejectSaved = () => {
    const name = matchedProfile?.recipient.name || recipientNameInput.trim()
    setForm(emptyForm(getLatestProfile(), initialSenderName, initialGiftMessage, name))
    setMatchedProfile(null)
    setStep('full-form')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.senderName.trim()) return
    const payload: CheckoutDetailsInput = {
      ...form,
      senderName: form.senderName.trim(),
      senderEmail: form.senderEmail.trim() || DEFAULT_SENDER_EMAIL,
      giftMessage: form.giftMessage?.trim() || undefined,
      specialInstructions: form.specialInstructions?.trim() || undefined,
    }
    saveProfile({
      recipient: payload.recipient,
      senderName: payload.senderName,
      senderEmail: payload.senderEmail,
      giftMessage: payload.giftMessage,
      specialInstructions: payload.specialInstructions,
    })
    onSubmit(payload)
  }

  const inputClass =
    variant === 'cart'
      ? 'w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-kapruka-header shadow-sm'
      : 'w-full rounded-xl border border-[var(--border-light)] bg-transparent px-3 py-2 text-sm outline-none focus:border-kapruka-header'

  if (step === 'recipient-name') {
    return (
      <form onSubmit={handleNameContinue} className="space-y-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {messages.form.askRecipientName}
        </p>
        <input
          required
          autoFocus
          placeholder={messages.form.name}
          value={recipientNameInput}
          onChange={(e) => setRecipientNameInput(e.target.value)}
          className={inputClass}
        />
        {profiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profiles.slice(0, 5).map((p) => (
              <button
                key={p.recipient.name}
                type="button"
                onClick={() => {
                  setRecipientNameInput(p.recipient.name)
                }}
                className="rounded-full border border-[#401F60]/30 px-3 py-1 text-xs font-medium text-[#401F60] dark:border-white/30 dark:text-white"
              >
                {p.recipient.name}
              </button>
            ))}
          </div>
        )}
        <button
          type="submit"
          className="w-full rounded-xl bg-kapruka-header py-2.5 text-sm font-medium text-white"
        >
          {messages.form.continue}
        </button>
        <button
          type="button"
          onClick={() => setStep('full-form')}
          className="w-full text-xs text-[var(--text-muted)] underline"
        >
          {messages.form.enterAllDetails}
        </button>
      </form>
    )
  }

  if (step === 'confirm-saved' && matchedProfile) {
    const p = matchedProfile
    return (
      <div className="space-y-3 rounded-xl border border-[#401F60]/20 bg-[#401F60]/5 p-4 text-sm dark:border-white/20 dark:bg-white/5">
        <p className="font-semibold text-[var(--text-primary)]">
          {messages.form.confirmSavedTitle.replace('{name}', p.recipient.name)}
        </p>
        <dl className="space-y-2 text-xs text-[var(--text-secondary)]">
          <div>
            <dt className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {messages.form.phone}
            </dt>
            <dd className="text-[var(--text-primary)]">{p.recipient.phone}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {messages.form.address}
            </dt>
            <dd className="text-[var(--text-primary)]">
              {p.recipient.address}, {p.recipient.city}
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {messages.form.senderName}
            </dt>
            <dd className="text-[var(--text-primary)]">{p.senderName}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {messages.form.senderEmail}
            </dt>
            <dd className="text-[var(--text-primary)]">{p.senderEmail}</dd>
          </div>
          {p.giftMessage && (
            <div>
              <dt className="font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {messages.form.giftMessage}
              </dt>
              <dd className="italic text-[var(--text-primary)]">&ldquo;{p.giftMessage}&rdquo;</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={confirmSaved}
            className="rounded-full bg-[#401F60] px-4 py-2 text-xs font-semibold text-white"
          >
            {messages.form.detailsCorrect}
          </button>
          <button
            type="button"
            onClick={rejectSaved}
            className="rounded-full border border-[var(--border-light)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
          >
            {messages.form.updateDetails}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {profiles.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setRecipientNameInput(form.recipient.name)
            setStep('recipient-name')
          }}
          className="text-xs text-kapruka-header underline"
        >
          {messages.form.pickSavedRecipient}
        </button>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {messages.form.senderName}
        </label>
        <input
          required
          value={form.senderName}
          onChange={(e) => setForm({ ...form, senderName: e.target.value })}
          placeholder={messages.form.senderNamePlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {messages.form.senderEmail}
        </label>
        <input
          required
          type="email"
          value={form.senderEmail}
          onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
          placeholder={DEFAULT_SENDER_EMAIL}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          <Gift className="h-3.5 w-3.5" /> {messages.form.giftMessageOptional}
        </label>
        <textarea
          placeholder={messages.form.giftMessagePlaceholder}
          value={form.giftMessage ?? ''}
          onChange={(e) => setForm({ ...form, giftMessage: e.target.value })}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {messages.form.specialInstructions}
        </label>
        <textarea
          placeholder={messages.form.specialInstructionsPlaceholder}
          value={form.specialInstructions ?? ''}
          onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {variant === 'chat' && (
        <p className="text-xs font-semibold text-kapruka-header">{messages.form.recipient}</p>
      )}

      <input
        required
        placeholder={messages.form.name}
        value={form.recipient.name}
        onChange={(e) => updateRecipient({ name: e.target.value })}
        className={inputClass}
      />
      <input
        required
        placeholder={messages.form.phone}
        value={form.recipient.phone}
        onChange={(e) => updateRecipient({ phone: e.target.value })}
        className={inputClass}
      />
      <input
        required
        placeholder={messages.form.address}
        value={form.recipient.address}
        onChange={(e) => updateRecipient({ address: e.target.value })}
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          placeholder={messages.form.city}
          value={form.recipient.city}
          onChange={(e) => updateRecipient({ city: e.target.value })}
          className={inputClass}
        />
        <input
          required
          type="date"
          value={form.recipient.date}
          onChange={(e) => updateRecipient({ date: e.target.value })}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={processing}
        className="w-full rounded-xl bg-kapruka-header py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {processing ? messages.cart.processing : messages.cart.checkoutNow}
      </button>
    </form>
  )
}
