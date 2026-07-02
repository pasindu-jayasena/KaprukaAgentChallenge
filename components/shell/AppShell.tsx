'use client'

import { useState, isValidElement, cloneElement } from 'react'
import { AppHeader } from '@/components/shell/AppHeader'
import { AmbientScene } from '@/components/chat/AmbientScene'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { useLanguage } from '@/providers/LanguageProvider'
import { VoiceOutputProvider } from '@/hooks/useVoiceOutput'

interface Props {
  children: React.ReactNode
  sidebar?: React.ReactNode
  collapsibleSidebar?: boolean
  onCheckoutViaChat?: (msg: string) => void
  onCheckoutSuccess?: (payload: import('@/types').CheckoutSuccessPayload) => void
  /** Chat page ambient background */
  ambient?: boolean
  /** Scrollable main column (homepage) */
  scrollMain?: boolean
}

export function AppShell({
  children,
  sidebar,
  collapsibleSidebar = false,
  onCheckoutViaChat,
  onCheckoutSuccess,
  ambient = false,
  scrollMain = false,
}: Props) {
  const { uiLang } = useLanguage()
  const [cartOpen, setCartOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const toggleCollapse = () => {
    setSidebarCollapsed((c) => !c)
  }

  const hasSidebar = !!sidebar
  const isSidebarLayout = hasSidebar && collapsibleSidebar
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

  const openSidebar = () => {
    if (window.innerWidth >= 1024) {
      if (sidebarCollapsed) toggleCollapse()
    } else {
      setMobileSidebarOpen(true)
    }
  }

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

  const header = (
    <AppHeader
      layout="chat"
      cartOpen={cartOpen}
      onCartOpen={() => setCartOpen((o) => !o)}
      onMenuToggle={isSidebarLayout ? openSidebar : undefined}
      showMenuIcon={isSidebarLayout ? sidebarCollapsed : false}
    />
  )

  if (isSidebarLayout) {
    return (
      <VoiceOutputProvider uiLang={uiLang}>
        <div className="anu-shell anu-shell--chat relative flex h-full min-h-0 flex-1 flex-row overflow-hidden">
          {ambient && <AmbientScene />}

          {!sidebarCollapsed && (
            <aside className="sessions-rail-panel shell-sidebar-full z-10 hidden h-full min-h-0 w-[260px] shrink-0 flex-col xl:w-[280px] lg:flex">
              {sidebarNode}
            </aside>
          )}

          <div className="shell-right relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {header}

            <div
              className={`shell-main flex min-h-0 flex-1 flex-col ${scrollMain ? 'shell-main--home' : 'overflow-hidden'}`}
            >
              <div className={scrollMain ? 'min-w-0 flex-1' : 'flex min-h-0 flex-1 overflow-hidden'}>
                <main
                  className={`min-w-0 flex-1 ${scrollMain ? '' : 'flex min-h-0 flex-col overflow-hidden'} ${
                    ambient ? 'px-2 pb-2 sm:px-3 sm:pb-3' : ''
                  }`}
                >
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
            onCheckoutSuccess={onCheckoutSuccess}
          />
        </div>
      </VoiceOutputProvider>
    )
  }

  return (
    <VoiceOutputProvider uiLang={uiLang}>
      <div className="anu-shell relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shell-right relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {header}

          <div className="shell-main shell-main--home flex min-h-0 flex-1 flex-col overflow-hidden">
            <main className="min-h-0 flex-1">{children}</main>
          </div>
        </div>

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckoutViaChat={onCheckoutViaChat}
          onCheckoutSuccess={onCheckoutSuccess}
        />
      </div>
    </VoiceOutputProvider>
  )
}
