'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Github, Menu, X, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Brand } from './Brand'

export function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const active = pathname === '/analyze' || pathname.startsWith('/repositories')

  return (
    <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#090a0c]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />

        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="/analyze"
            className={`px-3 py-2 font-mono text-[11px] uppercase tracking-[.12em] transition ${active ? 'text-white' : 'text-[#77736c] hover:text-white'}`}
          >
            Analyze
          </Link>
          <a
            href="https://github.com/arshchauhan28/RepoAutopsy"
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-1.5 border-l border-white/[.08] pl-4 font-mono text-[11px] uppercase tracking-[.12em] text-[#625f59] transition hover:text-white"
          >
            <Github size={13} /> Source <ArrowUpRight size={11} />
          </a>
        </nav>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="grid h-9 w-9 place-items-center border border-white/[.1] text-[#aaa69e] transition hover:bg-white/[.04] sm:hidden"
        >
          {open ? <X size={17} /> : <Menu size={17} />}
        </button>
      </div>

      <div className={`overflow-hidden border-t border-white/[.06] bg-[#0b0d10] transition-all duration-200 sm:hidden ${open ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
        <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
          <Link onClick={() => setOpen(false)} href="/analyze" className="flex items-center justify-between border-b border-white/[.06] py-3 font-mono text-[11px] uppercase tracking-[.12em] text-[#aaa69e]">
            Analyze <ArrowUpRight size={13} />
          </Link>
          <a onClick={() => setOpen(false)} href="https://github.com/arshchauhan28/RepoAutopsy" target="_blank" rel="noreferrer" className="flex items-center justify-between py-3 font-mono text-[11px] uppercase tracking-[.12em] text-[#77736c]">
            Source <Github size={13} />
          </a>
        </nav>
      </div>
    </header>
  )
}
