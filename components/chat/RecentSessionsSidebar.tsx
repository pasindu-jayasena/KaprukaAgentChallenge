'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, PanelLeftClose, SquarePen, Trash2 } from 'lucide-react'
import { useLanguage } from '@/providers/LanguageProvider'

interface SessionSummary {
  id: string
  title: string
  preview: string
  productCount: number
  thumbnailUrl: string | null
  updatedAt: string
}

interface Props {
  activeId?: string | null
  onSelect?: (id: string) => void
  onNewChat?: () => void | Promise<void>
  onSessionOpen?: () => void
  onCollapse?: () => void
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function RecentSessionsSidebar({
  activeId,
  onSelect,
  onNewChat,
  onSessionOpen,
  onCollapse,
}: Props) {
  const router = useRouter()
  const { messages } = useLanguage()
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  const load = useCallback(() => {
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((d: { sessions?: SessionSummary[] }) => setSessions(d.sessions ?? []))
      .catch(() => setSessions([]))
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [load])

  useEffect(() => {
    load()
  }, [activeId, load])

  const handleNewChat = async () => {
    if (onNewChat) {
      await onNewChat()
      load()
      onSessionOpen?.()
      return
    }
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: messages.sessions.newChat }),
    })
    const data = (await res.json()) as { id?: string }
    load()
    if (data.id) router.push(`/chat?session=${data.id}`)
    else router.push('/chat')
  }

  const openSession = (id: string) => {
    if (onSelect) {
      onSelect(id)
    } else {
      router.push(`/chat?session=${id}`)
    }
    onSessionOpen?.()
  }

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // Prevent opening the session when clicking delete
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeId === id) {
        if (onNewChat) await onNewChat()
        else router.push('/chat')
      }
    } catch {
      // Ignore
    }
  }

  return (
    <nav
      className="sessions-rail relative z-10 flex h-full min-h-0 flex-col"
      aria-label={messages.sessions.title}
    >
      {/* Sidebar Header Strip perfectly matching Topnav */}
      <div
        className="kap-topnav justify-between z-20 relative w-[calc(100%+1px)] !px-4 border-b border-r border-white/20"
        style={{ marginRight: '-1px' }}
      >
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white transition"
          aria-label={messages.sessions.home}
        >
          <Home className="h-5 w-5" />
        </Link>

        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white transition"
            aria-label={messages.sessions.collapse}
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="shrink-0 px-3 pt-4">
        {/* Big New Chat Button */}
        <button
          type="button"
          onClick={() => void handleNewChat()}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#FCE22A] px-4 py-3 font-bold text-[#401F60] hover:bg-[#e5cd22] transition shadow-sm"
        >
          <SquarePen className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          <span>{messages.sessions.newChat}</span>
        </button>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden px-2">
        <p className="rail-section-label shrink-0 px-3">{messages.sessions.recents}</p>
        <ul className="chat-scroll mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-3 px-1">
          {sessions.length === 0 && (
            <li className="px-3 py-4 text-xs leading-relaxed text-[var(--text-muted)]">
              {messages.sessions.empty}
            </li>
          )}
          {sessions.map((s) => {
            const isActive = activeId === s.id
            return (
              <li key={s.id} className="group relative">
                {isActive && (
                  <div className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-md bg-[#FCE22A]" />
                )}
                <button
                  type="button"
                  onClick={() => openSession(s.id)}
                  className={`flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 transition-colors ${isActive
                      ? 'bg-[#401F60] shadow-md'
                      : 'hover:bg-[var(--rail-hover)]'
                    }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={`truncate text-sm font-bold ${isActive ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                      {s.title || messages.sessions.newChat}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-medium transition-opacity ${
                        isActive
                          ? 'text-white/60 opacity-0'
                          : 'text-[var(--text-muted)] group-hover:opacity-0 group-focus-within:opacity-0'
                      }`}
                    >
                      {formatRelativeTime(s.updatedAt)}
                    </span>
                  </div>

                  {s.preview && (
                    <span className={`line-clamp-1 w-[90%] text-left text-xs italic ${isActive ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>
                      &ldquo;{s.preview}&rdquo;
                    </span>
                  )}

                  {s.productCount > 0 && (
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/15 text-white' : 'bg-kapruka-accent/20 text-kapruka-header dark:text-[var(--text-primary)]'}`}>
                      🛒 {s.productCount} item{s.productCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </button>

                {/* Delete button — swaps into the timestamp's spot so it never overlaps other UI */}
                <button
                  type="button"
                  onClick={(e) => deleteSession(e, s.id)}
                  className={`absolute right-2 top-1.5 rounded-full p-1.5 transition-all hover:bg-red-500 hover:text-white focus:opacity-100 ${
                    isActive
                      ? 'text-white/70 opacity-100'
                      : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100'
                  }`}
                  aria-label="Delete session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
