'use client'

import { useSyncExternalStore } from 'react'
import { useCartStore } from '@/store/cartStore'

export function CartBadge() {
  const totalItems = useCartStore((s) => s.totalItems())
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted || totalItems <= 0) return null

  return (
    <span
      suppressHydrationWarning
      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-kapruka-accent text-[9px] font-bold text-kapruka-header"
    >
      {totalItems}
    </span>
  )
}
