'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, Package, MapPin, Calendar, Gift, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import type { OrderResult } from '@/types'

interface Props {
  orderResult: OrderResult
  text?: string
  items?: Array<{ name: string; price: number; quantity: number; image?: string | null }>
  recipient?: { name: string; phone: string; city: string; address: string; date: string }
  subtotal?: number
  deliveryFee?: number
  total?: number
  giftMessage?: string
}

export function LockedCheckoutCard({
  orderResult,
  text,
  items,
  recipient,
  subtotal,
  deliveryFee,
  total,
  giftMessage,
}: Props) {
  const { messages } = useLanguage()
  const [secondsLeft, setSecondsLeft] = useState(3600)
  const [copied, setCopied] = useState(false)

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

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--border-light)] bg-[var(--bg-surface)] shadow-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#401F60] to-[#593082] p-5 text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3 mb-2">
          <CheckCircle2 className="h-6 w-6 text-[#FCE22A]" />
          <h3 className="font-display text-xl font-bold">Order Locked!</h3>
        </div>
        {text && <p className="text-white/80 text-sm mb-3">{text}</p>}
        {orderResult.ref && (
          <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2 mt-2 w-fit">
            <span className="text-sm font-mono text-white/90">Ref: {orderResult.ref}</span>
            <button
              type="button"
              onClick={copyRef}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Copy Reference"
            >
              <Copy className="h-3.5 w-3.5 text-white/70" />
            </button>
            {copied && <span className="text-xs text-[#FCE22A] ml-1">Copied!</span>}
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Items Section */}
        {items && items.length > 0 && (
          <div className="text-sm">
            <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold mb-2">
              <Package className="h-4 w-4" />
              <h4>Items</h4>
            </div>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex justify-between items-start gap-4 text-[var(--text-primary)]">
                  <span className="flex-1">
                    {item.name} <span className="text-[var(--text-muted)]">× {item.quantity}</span>
                  </span>
                  <span className="font-medium whitespace-nowrap">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recipient Section */}
        {recipient && (
          <>
            <div className="h-px bg-[var(--border-light)] w-full" />
            <div className="text-sm">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] font-semibold mb-2">
                <MapPin className="h-4 w-4" />
                <h4>Delivering To</h4>
              </div>
              <div className="text-[var(--text-primary)] leading-relaxed">
                <p className="font-medium">{recipient.name} · <span className="text-[var(--text-muted)]">{recipient.phone}</span></p>
                <p className="text-[var(--text-muted)] mt-0.5">{recipient.address}, {recipient.city}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[var(--text-secondary)]">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{recipient.date}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Gift Message */}
        {giftMessage && (
          <div className="bg-[#FFFBEB] dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-3 flex gap-2.5 text-sm">
            <Gift className="h-4 w-4 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-yellow-800 dark:text-yellow-200/90 italic">"{giftMessage}"</p>
          </div>
        )}

        {/* Pricing Summary */}
        {(subtotal != null || deliveryFee != null || total != null) && (
          <>
            <div className="h-px bg-[var(--border-light)] w-full" />
            <div className="text-sm space-y-1.5">
              {subtotal != null && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Subtotal</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
              )}
              {deliveryFee != null && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Delivery</span>
                  <span>Rs. {deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {total != null && (
                <div className="flex justify-between text-[var(--text-primary)] font-bold pt-1 mt-1 border-t border-[var(--border-light)]">
                  <span>Total</span>
                  <span>Rs. {total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Payment CTA */}
        {orderResult.url && (
          <div className="mt-2 text-center">
            <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">
              Expires in <span className="text-[#401F60] dark:text-[#FCE22A] font-bold tabular-nums">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
            </p>
            <a
              href={orderResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-full bg-[#FCE22A] hover:bg-[#FDEB6B] text-[#401F60] px-4 py-3.5 font-bold shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            >
              💳 Pay Now on Kapruka.com
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
