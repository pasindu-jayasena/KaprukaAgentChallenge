'use client'

import { useState, useEffect, isValidElement, cloneElement } from 'react'
import { PanelLeftOpen, X } from 'lucide-react'
import { AppHeader } from '@/components/shell/AppHeader'
import { SubNav } from '@/components/shell/SubNav'
import { AmbientScene } from '@/components/chat/AmbientScene'
import { CartDrawer } from '@/components/cart/CartDrawer'

interface Props {
  children: React.ReactNode
  sidebar?: React.ReactNode
  collapsibleSidebar?: boolean
  onCheckoutViaChat?: (msg: string) => void
  variant?: 'home' | 'chat'
}

export function AppShell({
  children,
  sidebar,
  collapsibleSidebar = false,
  onCheckoutViaChat,
  variant = 'home',
}: Props) {
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!collapsibleSidebar) return
    const stored = localStorage.getItem('anu-sessions-collapsed')
    if (stored === 'true') setSidebarCollapsed(true)
  }, [collapsibleSidebar])

  const toggleCollapse = () => {
    setSidebarCollapsed((c) => {
      const next = !c
      localStorage.setItem('anu-sessions-collapsed', String(next))
      return next
    })
  }

  const hasSidebar = !!sidebar
  const isChatRail = hasSidebar && collapsibleSidebar
  const sidebarNode =
    hasSidebar && isValidElement(sidebar) && collapsibleSidebar
      ? cloneElement(sidebar, {
          onCollapse: () => {
            if (window.innerWidth >= 1024) toggleCollapse()
            else setMobileSidebarOpen(false)
          },
          onSessionOpen: () => setMobileSidebarOpen(false),
        } as Record<string, unknown>)
      : sidebar

  const mobileDrawer =
    hasSidebar && mobileSidebarOpen ? (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sessions"
        />
        <aside className="sidebar-drawer sessions-rail-panel fixed inset-y-0 left-0 z-50 flex h-full w-[min(288px,88vw)] flex-col overflow-hidden lg:hidden">
          {sidebarNode}
        </aside>
      </>
    ) : null

  /* ── CHAT LAYOUT ── */
  if (isChatRail) {
    return (
      <div className="anu-shell anu-shell--chat relative flex h-full min-h-0 flex-1 flex-row overflow-hidden">
        <AmbientScene />

        {/* Desktop sidebar */}
        {!sidebarCollapsed && (
          <aside className="sessions-rail-panel shell-sidebar-full z-10 hidden h-full min-h-0 w-[260px] shrink-0 flex-col xl:w-[280px] lg:flex">
            {sidebarNode}
          </aside>
        )}

        {/* Collapsed state is now handled by the menu icon in the AppHeader */}

        {/* Main chat area */}
        <div className="shell-right relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AppHeader
            layout="chat"
            cartOpen={cartOpen}
            onCartOpen={() => setCartOpen((o) => !o)}
            onMenuToggle={() => {
              if (window.innerWidth >= 1024) {
                if (sidebarCollapsed) toggleCollapse()
              } else {
                setMobileSidebarOpen(true)
              }
            }}
            showMenuIcon={sidebarCollapsed}
          />

          <div className="shell-main flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 pb-2 sm:px-3 sm:pb-3">
                {children}
              </main>
            </div>
          </div>
        </div>

        {mobileDrawer}

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckoutViaChat={onCheckoutViaChat}
        />
      </div>
    )
  }

  /* ── HOME LAYOUT ── */
  return (
    <div className="anu-shell relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader cartOpen={cartOpen} onCartOpen={() => setCartOpen((o) => !o)} />

      <div className="shell-main shell-main--home relative z-10 flex min-h-0 flex-1 flex-col">
        <main className="min-h-0 flex-1">
          {children}
        </main>
      </div>

      {mobileDrawer}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckoutViaChat={onCheckoutViaChat}
      />
    </div>
  )
}
