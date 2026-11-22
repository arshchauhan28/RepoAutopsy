'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Nav } from '@/components/Nav'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log unexpected client error to monitoring
    console.error('Unhandled RepoAutopsy client error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0e0e0d] text-[#e8e4dc]">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
          <AlertTriangle size={28} />
        </div>

        <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-rose-400">
          Diagnostic System Exception
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Unexpected Application Error
        </h1>
        <p className="mt-3 text-xs leading-relaxed text-[#aaa69e]">
          The application encountered an unexpected runtime condition while rendering this view.
          Your repository data and assessment progress remain preserved.
        </p>

        {error.digest && (
          <div className="mt-3 font-mono text-[10px] text-[#77736c]">
            Digest ID: {error.digest}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400 px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-amber-300"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/[.12] bg-white/[.04] px-5 py-2.5 text-xs font-medium text-white transition hover:bg-white/[.08]"
          >
            <ArrowLeft size={14} />
            <span>Return to Home</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
