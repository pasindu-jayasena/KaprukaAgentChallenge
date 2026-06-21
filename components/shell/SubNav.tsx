'use client'

import { useRouter } from 'next/navigation'
import { Gift, Truck, Tag, Calendar, Award, User } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'

const SUBNAV_ITEMS = [
  { key: 'fathersDay', icon: Gift, query: "Father's Day gifts" },
  { key: 'rushDelivery', icon: Truck, query: 'Rush delivery products' },
  { key: 'onSale', icon: Tag, query: 'Products on sale' },
  { key: 'events', icon: Calendar, query: 'Event gifts' },
  { key: 'brands', icon: Award, query: 'Popular brands' },
  { key: 'forYou', icon: User, query: 'Recommended for me' },
] as const

type SubnavKey = (typeof SUBNAV_ITEMS)[number]['key']

const LABELS: Record<string, Record<SubnavKey, string>> = {
  en: {
    fathersDay: "Father's Day Offers",
    rushDelivery: 'Rush delivery',
    onSale: 'On Sale',
    events: 'Events',
    brands: 'Brands',
    forYou: 'For You',
  },
  si: {
    fathersDay: 'තාත්තාගේ දිනය',
    rushDelivery: 'ඉක්මන් බෙදාහැරීම',
    onSale: 'විකිණීමට',
    events: 'සිදුවීම්',
    brands: 'වෙළඳ නාම',
    forYou: 'ඔබට',
  },
  ta: {
    fathersDay: 'தந்தையர் தின சலுகை',
    rushDelivery: 'விரைவு டெலிவரி',
    onSale: 'விற்பனை',
    events: 'நிகழ்வுகள்',
    brands: 'பிராண்டுகள்',
    forYou: 'உங்களுக்காக',
  },
}

export function SubNav() {
  const router = useRouter()
  const { uiLang } = useLanguage()
  const lang = LABELS[uiLang] ?? LABELS.en

  return (
    <nav className="kap-subnav" aria-label="Quick categories">
      {SUBNAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => router.push(`/chat?q=${encodeURIComponent(item.query)}`)}
            className="kap-subnav-item"
          >
            <Icon className="kap-subnav-icon" strokeWidth={1.8} />
            <span>{lang[item.key]}</span>
          </button>
        )
      })}
    </nav>
  )
}
