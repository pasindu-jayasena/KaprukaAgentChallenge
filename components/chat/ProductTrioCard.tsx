'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, Star } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useLanguage } from '@/providers/LanguageProvider'
import type { ProductTrio } from '@/types'

interface Props {
  trio: ProductTrio
}

export function ProductTrioCard({ trio }: Props) {
  const { messages } = useLanguage()
  const addItem = useCartStore((s) => s.addItem)
  const items = useCartStore((s) => s.items)

  const products = trio.products ?? []

  return (
    <div className="space-y-2">
      {trio.context && (
        <p className="text-sm text-[var(--text-secondary)]">{trio.context}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {products.map((p, i) => {
          const id = (p as { product_id?: string }).product_id ?? p.id
          const image =
            (p as { image_url?: string }).image_url ?? p.image ?? null
          const inCart = items.some((x) => x.id === id)
          const isPick = p.pick ?? i === 1

          return (
            <motion.button
              key={id}
              type="button"
              whileHover={{ scale: 1.02 }}
              onClick={() =>
                addItem({
                  id,
                  name: p.name,
                  price: p.price,
                  image,
                  url: p.url,
                })
              }
              className={`rounded-xl border bg-[var(--bg-surface)] p-3 text-left shadow-sm transition ${
                isPick ? 'border-kapruka-accent ring-2 ring-kapruka-accent/30' : 'border-[var(--border-light)]'
              }`}
            >
              {isPick && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-kapruka-accent px-2 py-0.5 text-[10px] font-bold text-kapruka-header">
                  <Star className="h-3 w-3 fill-current" />
                  {messages.chat.anuPick}
                </span>
              )}
              <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-page)]">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">🛍️</span>
                )}
              </div>
              <p className="line-clamp-2 text-xs font-medium">{p.name}</p>
              {p.reason && (
                <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">{p.reason}</p>
              )}
              <p className="mt-1 text-sm font-bold text-kapruka-header">
                Rs. {p.price?.toLocaleString()}
              </p>
              <span
                className={`mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium ${
                  inCart
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-kapruka-header text-white'
                }`}
              >
                <ShoppingCart className="h-3 w-3" />
                {inCart ? messages.chat.added : messages.chat.add}
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
