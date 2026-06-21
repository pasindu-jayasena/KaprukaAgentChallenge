'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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
    cakes: 'කේක්',
    flowers: 'මල්',
    chocolates: 'චොකලට්',
    clothing: 'ඇඳුම්',
    electronics: 'ඉලෙක්ට්‍රොනික',
    fashion: 'විලාසිතා',
    food: 'ආහාර',
    fruits: 'පළතුරු',
    softToys: 'සෙල්ලම් බඩු',
    grocery: 'සිල්ලර',
  },
  ta: {
    cakes: 'கேக்குகள்',
    flowers: 'பூக்கள்',
    chocolates: 'சாக்லேட்',
    clothing: 'ஆடைகள்',
    electronics: 'மின்னணு',
    fashion: 'ஃபேஷன்',
    food: 'உணவு',
    fruits: 'பழங்கள்',
    softToys: 'பொம்மைகள்',
    grocery: 'மளிகை',
  },
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.15 },
  },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.2, 0.7, 0.2, 1] as const },
  },
}

export function CategoryGrid() {
  const router = useRouter()
  const { uiLang } = useLanguage()
  const labels = CATEGORY_LABELS[uiLang] ?? CATEGORY_LABELS.en

  return (
    <section className="kap-categories">
      <motion.div
        className="kap-categories-grid"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.slug}
            type="button"
            variants={item}
            onClick={() => router.push(`/chat?q=${encodeURIComponent(labels[cat.key] ?? cat.slug)}`)}
            className="kap-category-item"
          >
            <div className="kap-category-circle">
              <span role="img" aria-label={labels[cat.key]}>
                {cat.emoji}
              </span>
            </div>
            <span className="kap-category-label">{labels[cat.key] ?? cat.slug}</span>
          </motion.button>
        ))}
      </motion.div>
    </section>
  )
}
