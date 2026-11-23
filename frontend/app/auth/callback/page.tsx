'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { submitOAuthCallback } from '@/lib/api'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
      setError('Missing OAuth authentication parameters (code or state). Please try signing in again.')
      setLoading(false)
      return
    }

    const exchange = async () => {
      try {
        await submitOAuthCallback(code, state)
        router.push('/dashboard')
      } catch (err: any) {
        setError(err?.message || 'Authentication exchange failed.')
        setLoading(false)
      }
    }

    exchange()
  }, [searchParams, router])

  return (
    <div className="card mx-auto max-w-md p-8 text-center reveal">
      {loading ? (
        <div className="space-y-4">
          <Loader2 size={32} className="mx-auto animate-spin text-amber-400" />
          <h2 className="text-base font-semibold text-white">Authenticating with GitHub…</h2>
          <p className="text-xs text-[#aaa69e]">
            Verifying secure OAuth credentials, establishing your workspace session, and synchronizing account profile.
          </p>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-400">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-base font-semibold text-rose-300">Sign-In Failed</h2>
          <p className="text-xs text-[#aaa69e] leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded border border-white/[.15] bg-white/[.04] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[.08]"
            >
              <span>Return to Home</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="card mx-auto max-w-md p-8 text-center text-xs text-[#77736c]">
              Loading authentication…
            </div>
          }
        >
          <AuthCallbackContent />
        </Suspense>
      </main>
    </div>
  )
}
