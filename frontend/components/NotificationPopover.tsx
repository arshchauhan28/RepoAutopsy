'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, Check, ExternalLink, X } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from '@/lib/api'

interface NotificationPopoverProps {
  unreadCount: number
  onCountChange?: (newCount: number) => void
}

export function NotificationPopover({ unreadCount, onCountChange }: NotificationPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const items = await getNotifications(10)
      setNotifications(items)
    } catch {
      // Ignore background fetch error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen])

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await markNotificationRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      if (onCountChange && unreadCount > 0) {
        onCountChange(unreadCount - 1)
      }
    } catch {
      // Ignore
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      if (onCountChange) onCountChange(0)
    } catch {
      // Ignore
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative grid h-8 w-8 place-items-center rounded border border-white/[.1] text-[#aaa69e] hover:bg-white/[.04] hover:text-white transition"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 font-mono text-[9px] font-bold text-black ring-2 ring-[#090a0c]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:bg-transparent" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-x-3 top-16 z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/[.12] bg-[#0c0f13] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-mono text-amber-400 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[#77736c] hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto space-y-2 divide-y divide-white/[.04]">
              {loading && notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#77736c]">Loading notifications…</div>
              ) : notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#77736c]">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`pt-2.5 pb-2 text-xs transition ${
                      !n.is_read ? 'bg-amber-400/[.03] -mx-2 px-2 rounded' : 'opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-white text-[12px]">{n.title}</div>
                      {!n.is_read && (
                        <button
                          onClick={(e) => handleMarkRead(n.id, e)}
                          title="Mark as read"
                          className="shrink-0 text-[#77736c] hover:text-amber-400"
                        >
                          <Check size={12} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-[#aaa69e] leading-relaxed">{n.message}</p>
                    <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#77736c]">
                      <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {n.resource_url && (
                        <Link
                          href={n.resource_url}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-amber-300 hover:underline"
                        >
                          View <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
