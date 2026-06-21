'use client'

import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/shell/AppShell'
import { RecentSessionsSidebar } from '@/components/chat/RecentSessionsSidebar'
import { HomeHero } from '@/components/home/HomeHero'
import { CategoryGrid } from '@/components/home/CategoryGrid'

export default function HomePage() {
  const router = useRouter()

  return (
    <AppShell
      collapsibleSidebar
      scrollMain
      sidebar={<RecentSessionsSidebar />}
      onCheckoutViaChat={(msg) => {
        router.push(`/chat?q=${encodeURIComponent(msg)}`)
      }}
      onCheckoutSuccess={() => {
        router.push('/chat')
      }}
    >
      <HomeHero />
      <CategoryGrid />
    </AppShell>
  )
}
