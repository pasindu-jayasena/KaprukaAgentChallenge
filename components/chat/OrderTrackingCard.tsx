'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Copy, MapPin, PackageCheck, ReceiptText, Truck } from 'lucide-react'
import type { OrderTracking } from '@/types'

interface Props {
  tracking: OrderTracking
}

function formatAmount(amount?: { value: string; currency: string }) {
  if (!amount?.value) return null
  const n = Number(amount.value)
  const value = Number.isFinite(n) ? n.toLocaleString() : amount.value
  return amount.currency === 'LKR' ? 'Rs. ' + value : amount.currency + ' ' + value
}

function cleanValue(value?: string) {
  return value?.trim() || 'Not available'
}

export function OrderTrackingCard({ tracking }: Props) {
  const [copied, setCopied] = useState(false)
  const orderNumber = tracking.orderNumber || tracking.ref
  const delivered = tracking.status.toLowerCase() === 'delivered'
  const amount = formatAmount(tracking.amount)
  const progress: Array<{ step: string; timestamp?: string; done?: boolean }> = tracking.progress?.length
    ? tracking.progress
    : tracking.steps?.map((s) => ({ step: s.label, done: s.done, timestamp: undefined })) ?? []
  const statusClass = delivered
    ? 'bg-emerald-400 text-[#10351f]'
    : 'bg-[#FCE22A] text-[#401F60]'

  const copyOrder = () => {
    if (!orderNumber) return
    navigator.clipboard.writeText(orderNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-surface)] shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-r from-[#401F60] to-[#6D3A96] px-4 py-4 text-white">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ' + statusClass}>
                {delivered ? <PackageCheck className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                {tracking.statusDisplay || tracking.status}
              </span>
              {tracking.liveTrackingAvailable && (
                <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold text-white/85">
                  Live tracking
                </span>
              )}
            </div>
            <h3 className="truncate font-display text-lg font-extrabold leading-tight">
              Order {orderNumber}
            </h3>
            {tracking.pnref && <p className="mt-0.5 text-xs text-white/75">PN Ref: {tracking.pnref}</p>}
          </div>
          <button
            type="button"
            onClick={copyOrder}
            className="shrink-0 rounded-full bg-white/12 p-2 text-white transition-colors hover:bg-white/20 active:scale-95"
            aria-label="Copy order number"
            title="Copy order number"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        {copied && <p className="mt-2 text-xs font-semibold text-[#FCE22A]">Copied order number</p>}
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <p className="font-bold uppercase tracking-wide text-[var(--text-muted)]">Delivery</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">{cleanValue(tracking.deliveryDate)}</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <p className="font-bold uppercase tracking-wide text-[var(--text-muted)]">Amount</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">{amount ?? 'Not available'}</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <p className="font-bold uppercase tracking-wide text-[var(--text-muted)]">City</p>
            <p className="mt-1 truncate font-semibold text-[var(--text-primary)]">{cleanValue(tracking.recipient?.city)}</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <p className="font-bold uppercase tracking-wide text-[var(--text-muted)]">Latest</p>
            <p className="mt-1 line-clamp-2 font-semibold text-[var(--text-primary)]">{tracking.latestUpdate?.timestamp ?? tracking.shippedDate ?? tracking.orderDate ?? 'Not available'}</p>
          </div>
        </div>

        {tracking.comments && (
          <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-[var(--text-primary)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p>{tracking.comments}</p>
          </div>
        )}

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-[var(--border-light)] p-3">
            <div className="mb-2 flex items-center gap-2 font-bold text-[var(--text-primary)]">
              <MapPin className="h-4 w-4 text-[#401F60] dark:text-[#FCE22A]" />
              Recipient
            </div>
            <p className="font-semibold text-[var(--text-primary)]">{cleanValue(tracking.recipient?.name)}</p>
            <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">
              {cleanValue(tracking.recipient?.address)}
            </p>
            {tracking.recipient?.phone && <p className="mt-1 text-xs text-[var(--text-muted)]">{tracking.recipient.phone}</p>}
          </div>

          <div className="min-w-0 rounded-xl border border-[var(--border-light)] p-3">
            <div className="mb-2 flex items-center gap-2 font-bold text-[var(--text-primary)]">
              <ReceiptText className="h-4 w-4 text-[#401F60] dark:text-[#FCE22A]" />
              Message
            </div>
            <p className="break-words text-xs leading-relaxed text-[var(--text-secondary)]">
              {tracking.greetingMessage || tracking.specialInstructions || 'No message attached.'}
            </p>
          </div>
        </div>

        {progress.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Delivery timeline
            </p>
            <ol className="space-y-0">
              {progress.map((step, i) => {
                const done = step.done !== false
                const dotClass = done
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[var(--bg-page)] text-[var(--text-muted)]'
                return (
                  <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <span className={'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ' + dotClass}>
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      </span>
                      {i < progress.length - 1 && <span className="min-h-5 w-px flex-1 bg-[var(--border-light)]" />}
                    </div>
                    <div className="min-w-0 pb-3">
                      <p className="break-words text-sm font-semibold leading-snug text-[var(--text-primary)]">
                        {step.step}
                      </p>
                      {step.timestamp && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{step.timestamp}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
