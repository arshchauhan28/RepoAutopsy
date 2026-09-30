import Link from 'next/link'
import { Github, ArrowUpRight } from 'lucide-react'
import { Brand } from './Brand'

export function Nav() {
  return <header className="sticky top-0 z-40 border-b border-white/5 bg-[#070a12]/80 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
      <Brand/>
      <nav className="flex items-center gap-5 text-sm text-slate-400">
        <Link href="/analyze" className="transition hover:text-white">Analyze</Link>
        <a href="https://github.com" target="_blank" rel="noreferrer" className="hidden items-center gap-1 sm:flex hover:text-white"><Github size={15}/> GitHub <ArrowUpRight size={13}/></a>
      </nav>
    </div>
  </header>
}
