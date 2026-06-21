'use client'

import { AppShell } from '@/components/shell/AppShell'
import { HomeHero } from '@/components/home/HomeHero'
import { CategoryGrid } from '@/components/home/CategoryGrid'
import { AskAnuSection } from '@/components/home/AskAnuSection'

export default function HomePage() {
  return (
    <AppShell variant="home">
      <HomeHero />
      <CategoryGrid />
    </AppShell>
  )
}
