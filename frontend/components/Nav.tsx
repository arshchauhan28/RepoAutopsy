'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Github, Menu, X, ArrowUpRight, LogOut, LayoutDashboard, Building2, User as UserIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Brand } from './Brand'
import { NotificationPopover } from './NotificationPopover'
import { getAuthStatus, getGitHubLoginRedirectUrl, getLoginUrl, logout, getUnreadNotificationCount, type User } from '@/lib/api'

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkAuth = async () => {
      try {
        const res = await getAuthStatus()
        if (mounted && res.authenticated && res.user) {
          setUser(res.user)
          try {
            const notifRes = await getUnreadNotificationCount()
            if (mounted) setUnreadCount(notifRes.unread_count)
          } catch {
            // Ignore notification fetch error
          }
        } else if (mounted) {
          setUser(null)
        }
      } catch {
        if (mounted) setUser(null)
      }
    }
    checkAuth()
    return () => {
      mounted = false
    }
  }, [pathname])

  // Close menus on path change or escape key
  useEffect(() => {
    setOpen(false)
    setUserMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleSignIn = () => {
    setLoginLoading(true)
    const target = pathname && !pathname.startsWith('/auth') ? pathname : '/dashboard'
    window.location.href = getGitHubLoginRedirectUrl(target)
  }

  const handleLogout = async () => {
    try {
      await logout()
      setUser(null)
      setUserMenuOpen(false)
      router.push('/')
      router.refresh()
    } catch {
      // Ignore
    }
  }

  const isAnalyzeActive = pathname === '/analyze' || pathname.startsWith('/repositories')
  const isDashboardActive = pathname.startsWith('/dashboard')
  const isWorkspacesActive = pathname.startsWith('/workspaces')

  return (
    <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#08090b]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Brand />

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main Navigation">
            <Link
              href="/analyze"
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isAnalyzeActive
                  ? 'text-white font-semibold bg-white/[.04]'
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/[.02]'
              }`}
            >
              Analyze
            </Link>

            <Link
              href="/dashboard"
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isDashboardActive
                  ? 'text-white font-semibold bg-white/[.04]'
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/[.02]'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/workspaces"
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isWorkspacesActive
                  ? 'text-white font-semibold bg-white/[.04]'
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/[.02]'
              }`}
            >
              Workspaces
            </Link>

            <a
              href="https://github.com/arshchauhan28/RepoAutopsy"
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-1.5 border-l border-white/[.08] pl-4 font-mono text-[11px] uppercase tracking-[.12em] text-[#6b7280] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
            >
              <Github size={13} /> Source <ArrowUpRight size={11} />
            </a>
          </nav>
        </div>

        {/* RIGHT ACTION CONTROLS */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <>
              <NotificationPopover
                unreadCount={unreadCount}
                onCountChange={(count) => setUnreadCount(count)}
              />

              <div className="relative">
                <button
                  type="button"
                  id="user-menu-button"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-full border border-white/[.12] bg-white/[.03] pl-1.5 pr-3 py-1 hover:border-amber-400/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="h-6 w-6 rounded-full border border-white/20 object-cover"
                    />
                  ) : (
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-amber-400/20 text-amber-300 font-mono text-[11px] font-bold">
                      {user.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="font-mono text-xs text-[#d1d5db] max-w-[120px] truncate">
                    {user.display_name || user.username}
                  </span>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div
                      role="menu"
                      aria-labelledby="user-menu-button"
                      className="absolute right-0 top-10 z-50 w-52 rounded-lg border border-white/[.12] bg-[#0c0f13] p-1.5 shadow-2xl backdrop-blur-xl text-xs"
                    >
                      <div className="border-b border-white/[.08] px-3 py-2 text-[11px]">
                        <p className="font-medium text-white truncate">{user.display_name || user.username}</p>
                        <p className="font-mono text-[10px] text-[#9ca3af] truncate">@{user.username}</p>
                      </div>

                      <div className="py-1">
                        <Link
                          role="menuitem"
                          href="/dashboard"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded px-3 py-2 text-[#d1d5db] hover:bg-white/[.04] hover:text-white transition-colors"
                        >
                          <LayoutDashboard size={13} />
                          <span>Dashboard</span>
                        </Link>
                        <Link
                          role="menuitem"
                          href="/workspaces"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded px-3 py-2 text-[#d1d5db] hover:bg-white/[.04] hover:text-white transition-colors"
                        >
                          <Building2 size={13} />
                          <span>Workspaces</span>
                        </Link>
                      </div>

                      <div className="border-t border-white/[.08] pt-1">
                        <button
                          role="menuitem"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 rounded px-3 py-2 text-rose-300 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut size={13} />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={loginLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[.15] bg-white/[.04] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[.1em] text-[#d1d5db] transition-colors hover:border-amber-400/50 hover:bg-white/[.08] hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Github size={13} />
              <span>{loginLoading ? 'Redirecting…' : 'Sign in with GitHub'}</span>
            </button>
          )}
        </div>

        {/* MOBILE HAMBURGER BUTTON */}
        <div className="flex items-center gap-2 sm:hidden">
          {user && (
            <NotificationPopover
              unreadCount={unreadCount}
              onCountChange={(count) => setUnreadCount(count)}
            />
          )}

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/[.1] text-[#9ca3af] transition-colors hover:bg-white/[.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <div
        className={`overflow-hidden border-t border-white/[.06] bg-[#0b0d10] transition-all duration-200 sm:hidden ${
          open ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2" aria-label="Mobile Navigation">
          <Link
            onClick={() => setOpen(false)}
            href="/analyze"
            className={`flex items-center justify-between border-b border-white/[.06] py-2.5 font-mono text-[11px] uppercase tracking-[.12em] ${
              isAnalyzeActive ? 'text-white font-semibold' : 'text-[#9ca3af]'
            }`}
          >
            Analyze <ArrowUpRight size={13} />
          </Link>
          <Link
            onClick={() => setOpen(false)}
            href="/dashboard"
            className={`flex items-center justify-between border-b border-white/[.06] py-2.5 font-mono text-[11px] uppercase tracking-[.12em] ${
              isDashboardActive ? 'text-white font-semibold' : 'text-[#9ca3af]'
            }`}
          >
            Dashboard <ArrowUpRight size={13} />
          </Link>
          <Link
            onClick={() => setOpen(false)}
            href="/workspaces"
            className={`flex items-center justify-between border-b border-white/[.06] py-2.5 font-mono text-[11px] uppercase tracking-[.12em] ${
              isWorkspacesActive ? 'text-white font-semibold' : 'text-[#9ca3af]'
            }`}
          >
            Workspaces <ArrowUpRight size={13} />
          </Link>
          <a
            onClick={() => setOpen(false)}
            href="https://github.com/arshchauhan28/RepoAutopsy"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between border-b border-white/[.06] py-2.5 font-mono text-[11px] uppercase tracking-[.12em] text-[#6b7280]"
          >
            Source <Github size={13} />
          </a>

          <div className="pt-3 pb-2">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {user.avatar_url && (
                    <img src={user.avatar_url} alt={user.username} className="h-6 w-6 rounded-full" />
                  )}
                  <span className="font-mono text-xs text-white">@{user.username}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="font-mono text-xs text-rose-300 hover:underline"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/[.15] bg-white/[.04] py-2 font-mono text-[11px] uppercase tracking-[.1em] text-white"
              >
                <Github size={13} /> Sign in with GitHub
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
