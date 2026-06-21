'use client'

import { ExternalLink, Sparkles } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'
import type { Product } from '@/types'

interface Props {
  product: Product
  onChoose: () => void
  onBack: () => void
}

export function ProductDetailCard({ product, onChoose, onBack }: Props) {
  const { messages } = useLanguage()
  const kaprukaUrl =
    product.url ??
    (product.id ? `https://www.kapruka.com/srilanka/${product.id}` : 'https://www.kapruka.com')

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-surface)] shadow-md">
      <div className="relative h-48 w-full overflow-hidden bg-[var(--bg-page)]">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-5xl">🎁</span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <h3 className="font-display text-lg font-bold leading-snug text-[var(--text-primary)]">
          {product.name}
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-extrabold text-[#401F60] dark:text-[#FCE22A]">
            LKR {product.price?.toLocaleString()}
          </span>
          {product.in_stock !== false && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {messages.chat.inStock}
            </span>
          )}
        </div>

        {product.reason && (
          <div className="rounded-xl bg-[#401F60]/5 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#401F60] dark:text-[#FCE22A]">
              <Sparkles className="h-3.5 w-3.5" />
              {messages.chat.anuTake}
            </p>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{product.reason}</p>
          </div>
        )}

        {(product.description || product.reason) && (
          <div>
            <p className="mb-1 text-sm font-bold text-[var(--text-primary)]">
              {messages.chat.aboutItem}
            </p>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {product.description ?? product.reason}
            </p>
          </div>
        )}

        <a
          href={kaprukaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#401F60] hover:underline dark:text-[#FCE22A]"
        >
          {messages.chat.viewOnKapruka}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <button
            type="button"
            onClick={onChoose}
            className="flex-1 rounded-full bg-[#FCE22A] px-4 py-3 text-sm font-bold text-[#401F60] shadow-sm transition hover:bg-[#FDEB6B]"
          >
            {messages.chat.chooseThis}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-full border border-[var(--border-medium)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-page)]"
          >
            {messages.chat.backToOptions}
          </button>
        </div>
      </div>
    </div>
  )
}
