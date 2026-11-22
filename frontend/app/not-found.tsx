import Link from 'next/link'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import { Nav } from '@/components/Nav'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0e0e0d] text-[#e8e4dc]">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-400">
          <FileQuestion size={28} />
        </div>

        <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-amber-400">
          404 — Specimen Not Found
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Resource Unavailable
        </h1>
        <p className="mt-3 text-xs leading-relaxed text-[#aaa69e]">
          The requested repository analysis, assessment session, or page could not be located in the diagnostic records.
        </p>

        <div className="mt-7 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400 px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-amber-300"
          >
            <ArrowLeft size={14} />
            <span>Return to Repository Overview</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
