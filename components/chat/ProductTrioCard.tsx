'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Compass, Info, ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useLanguage } from '@/providers/LanguageProvider'
import { formatCurrency } from '@/lib/i18n/format'
import { ProductDetailCard } from '@/components/chat/ProductDetailCard'
import type { Product, ProductTrio } from '@/types'

interface Props {
  trio: ProductTrio
  onAddToCart?: (product: { id: string; name: string; price: number }) => void
  onShowMore?: () => void
}

type NormalizedProduct = Product & { product_id?: string; image_url?: string | null }

const FALLBACK_SCROLL_STEP = 232
const INITIAL_VISIBLE = 6

function normalizeProduct(p: NormalizedProduct, i: number): Product {
  return {
    id: p.product_id ?? p.id,
    name: p.name,
    price: p.price,
    image: p.image_url ?? p.image ?? null,
    url: p.url ?? null,
    reason: p.reason,
    description: p.description ?? p.reason,
    pick: p.pick ?? i === 0,
    in_stock: p.in_stock !== false,
  }
}

export function ProductTrioCard({ trio, onAddToCart, onShowMore }: Props) {
  const { messages, uiLang } = useLanguage()
  const addItem = useCartStore((s) => s.addItem)
  const items = useCartStore((s) => s.items)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})
  const railRef = useRef<HTMLDivElement>(null)

  const products = (trio.products ?? []).map((p, i) =>
    normalizeProduct(p as NormalizedProduct, i)
  )
  const visibleProducts = products.slice(0, visibleCount)
  const hasHiddenProducts = products.length > visibleCount
  const detailProduct = products.find((p) => p.id === detailId) ?? null

  // Measure the real card width so snapping math stays correct on narrow screens
  const getScrollStep = useCallback(() => {
    const firstCard = railRef.current?.querySelector<HTMLElement>('.product-rail-card')
    return firstCard ? firstCard.offsetWidth + 12 : FALLBACK_SCROLL_STEP
  }, [])

  const syncActiveIndex = useCallback(() => {
    const rail = railRef.current
    if (!rail || visibleProducts.length === 0) return
    const index = Math.round(rail.scrollLeft / getScrollStep())
    setActiveIndex(Math.min(Math.max(index, 0), visibleProducts.length - 1))
  }, [visibleProducts.length, getScrollStep])

  const scrollToIndex = (index: number) => {
    railRef.current?.scrollTo({ left: index * getScrollStep(), behavior: 'smooth' })
    setActiveIndex(index)
  }

  const markImageBroken = (id: string) =>
    setBrokenImages((prev) => (prev[id] ? prev : { ...prev, [id]: true }))

  const handleAdd = (p: Product) => {
    if (p.in_stock === false) return
    const wasInCart = items.some((x) => x.id === p.id)
    addItem({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      url: p.url,
    })
    if (!wasInCart) onAddToCart?.({ id: p.id, name: p.name, price: p.price })
    setDetailId(null)
  }

  if (detailProduct) {
    return (
      <ProductDetailCard
        product={detailProduct}
        onChoose={() => handleAdd(detailProduct)}
        onBack={() => setDetailId(null)}
      />
    )
  }

  const showDots = visibleProducts.length > 1
  const showMoreTile = hasHiddenProducts || !!onShowMore

  return (
    <div className="w-full min-w-0 space-y-3">
      {trio.context && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{trio.context}</p>
      )}

      <div
        ref={railRef}
        onScroll={syncActiveIndex}
        className="product-rail flex w-full gap-3 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory scroll-smooth"
      >
        {visibleProducts.map((p) => {
          const inCart = items.some((x) => x.id === p.id)
          const outOfStock = p.in_stock === false
          const imageBroken = !p.image || brokenImages[p.id]

          return (
            <motion.article
              key={p.id}
              layout
              className={`product-rail-card snap-start shrink-0 w-[min(72vw,220px)] overflow-hidden rounded-2xl border shadow-sm transition ${
                p.pick
                  ? 'border-[#FCE22A] bg-gradient-to-b from-[#FFF9D6] to-[var(--bg-surface)] ring-1 ring-[#FCE22A]/40 dark:from-[#3a2d00]'
                  : 'border-[var(--border-light)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="relative">
                {p.pick && (
                  <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-[#401F60] px-2 py-0.5 text-[10px] font-bold text-[#FCE22A]">
                    <Compass className="h-3 w-3" />
                    {messages.chat.anuPick}
                  </span>
                )}
                {outOfStock && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
                    {messages.chat.outOfStock}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDetailId(p.id)}
                  className="block h-36 w-full overflow-hidden bg-[var(--bg-page)]"
                >
                  {!imageBroken ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image!}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      onError={() => markImageBroken(p.id)}
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-4xl" aria-hidden>
                      🎁
                    </span>
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-2 p-3">
                <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-[var(--text-primary)]">
                  {p.name}
                </p>
                <p className="text-base font-extrabold text-[#401F60] dark:text-[#FCE22A]">
                  {formatCurrency(p.price ?? 0, uiLang)}
                </p>
                {p.reason && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                    {p.reason}
                  </p>
                )}

                <div className="mt-1 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(p.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#401F60] hover:underline dark:text-[#FCE22A]"
                  >
                    <Info className="h-3.5 w-3.5" />
                    {messages.chat.details}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdd(p)}
                    disabled={outOfStock}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      outOfStock
                        ? 'bg-[var(--border-light)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
                        : inCart
                        ? 'bg-green-500/15 text-green-600'
                        : 'bg-[#401F60] text-[#FCE22A] hover:bg-[#593082]'
                    }`}
                    aria-label={
                      outOfStock
                        ? messages.chat.outOfStock
                        : inCart
                        ? messages.chat.added
                        : messages.chat.add
                    }
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.article>
          )
        })}

        {showMoreTile && (
          <button
            type="button"
            onClick={() => {
              if (hasHiddenProducts) {
                setVisibleCount((c) => c + INITIAL_VISIBLE)
              } else {
                onShowMore?.()
              }
            }}
            className="product-rail-card snap-start flex shrink-0 w-[min(72vw,220px)] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border-medium)] bg-[var(--bg-surface)] p-4 text-center transition hover:border-[#401F60] hover:bg-[var(--rail-hover)] dark:hover:border-[#FCE22A]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#401F60]/10 text-[#401F60] dark:bg-[#FCE22A]/10 dark:text-[#FCE22A]">
              <ChevronRight className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {hasHiddenProducts ? messages.chat.showMore : messages.chat.moreLikeThese}
            </span>
          </button>
        )}
      </div>

      {showDots && (
        <div className="flex justify-center gap-1.5 pt-0.5">
          {visibleProducts.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? 'w-5 bg-[#401F60] dark:bg-[#FCE22A]'
                  : 'w-1.5 bg-[var(--border-medium)]'
              }`}
              aria-label={`${messages.chat.details} ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
