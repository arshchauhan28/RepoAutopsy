'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

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
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
          <AlertTriangle size={28} />
        </div>

        <div className="mt-4 font-mono text-xs uppercase tracking-widest text-rose-400">
          Diagnostic System Exception
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Unexpected Application Error
        </h1>
        <p className="mt-3 text-xs leading-relaxed text-[#9ca3af]">
          The application encountered an unexpected runtime condition while rendering this view.
          Your repository data and assessment progress remain preserved.
        </p>

        {error.digest && (
          <div className="mt-3 font-mono text-[10px] text-[#6b7280]">
            Digest ID: {error.digest}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => reset()}
            leftIcon={<RefreshCw size={14} />}
          >
            Try Again
          </Button>

          <Link href="/">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<ArrowLeft size={14} />}
            >
              Return to Home
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
