'use client'

import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/config/site'
import { useLanguage } from '@/providers/LanguageProvider'

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  en: {
    cakes: 'Cakes',
    flowers: 'Flowers',
    chocolates: 'Chocolates',
    clothing: 'Clothing',
    electronics: 'Electronics',
    fashion: 'Fashion',
    food: 'Food & Restaurants',
    fruits: 'Fruits',
    softToys: 'Soft Toys & Kids Toys',
    grocery: 'Grocery & Hampers',
  },
  si: {
    cakes: 'Cakes',
    flowers: 'Flowers',
    chocolates: 'Chocolates',
    clothing: 'Clothing',
    electronics: 'Electronics',
    fashion: 'Fashion',
    food: 'Food & Restaurants',
    fruits: 'Fruits',
    softToys: 'Soft toys',
    grocery: 'Grocery & Hampers',
  },
  ta: {
    cakes: 'Cakes',
    flowers: 'Flowers',
    chocolates: 'Chocolates',
    clothing: 'Clothing',
    electronics: 'Electronics',
    fashion: 'Fashion',
    food: 'Food & Restaurants',
    fruits: 'Fruits',
    softToys: 'Soft toys',
    grocery: 'Grocery & Hampers',
  },
}

export function CategoryGrid() {
  const router = useRouter()
  const { uiLang } = useLanguage()
  const labels = CATEGORY_LABELS[uiLang] ?? CATEGORY_LABELS.en

  return (
    <section className="kap-categories">
      <div className="kap-categories-grid">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => router.push(`/chat?q=${encodeURIComponent(labels[cat.key] ?? cat.slug)}`)}
            className="kap-category-item"
          >
            <div className="kap-category-circle">
              <span role="img" aria-label={labels[cat.key]}>
                {cat.emoji}
              </span>
            </div>
            <span className="kap-category-label">{labels[cat.key] ?? cat.slug}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
