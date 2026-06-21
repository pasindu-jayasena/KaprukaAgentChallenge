'use client'

import Link from 'next/link'
import { Gift, Truck, Tag, Calendar, Bookmark, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/providers/LanguageProvider'

const ITEMS = [
  { key: 'fathersDay', icon: Gift, href: '/chat?intent=fathers-day' },
  { key: 'rush', icon: Truck, href: '/chat?intent=rush' },
  { key: 'onSale', icon: Tag, href: '/chat?intent=sale' },
  { key: 'events', icon: Calendar, href: '/chat?intent=events' },
  { key: 'brands', icon: Bookmark, href: '/chat?intent=brands' },
  { key: 'forYou', icon: User, href: '/chat?intent=for-you' },
] as const

export function SubNav() {
  const { messages } = useLanguage()

  return (
    <nav className="bg-kapruka-subnav text-white">
      <ul className="mx-auto flex max-w-7xl items-center justify-center gap-4 overflow-x-auto px-4 py-2.5 text-xs sm:gap-8 sm:text-sm snap-x">
        {ITEMS.map((item, i) => {
          const Icon = item.icon
          const label =
            messages.subnav[item.key as keyof typeof messages.subnav]
          return (
            <motion.li
              key={item.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 snap-center"
            >
              <Link
                href={item.href}
                className="flex items-center gap-1.5 whitespace-nowrap opacity-90 transition hover:opacity-100"
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {label}
              </Link>
            </motion.li>
          )
        })}
      </ul>
    </nav>
  )
}
