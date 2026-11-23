'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Users, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { joinWorkspace, getAuthStatus } from '@/lib/api'

export default function WorkspaceInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await getAuthStatus()
        setIsAuthenticated(res.authenticated)
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  const handleAccept = async () => {
    setLoading(true)
    setError(null)
    try {
      const ws = await joinWorkspace(token)
      setSuccess(true)
      setWorkspaceName(ws.name)
      setWorkspaceId(ws.id)
    } catch (err: any) {
      setError(err?.message || 'Unable to accept invitation. The invitation may be invalid, expired, or restricted to another account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-md px-4 py-20 sm:px-6 lg:px-8">
        <div className="card p-8 text-center space-y-4 reveal">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-400/10 text-amber-400">
            <Building2 size={24} />
          </div>

          <h1 className="text-xl font-semibold text-white">Workspace Invitation</h1>
          <p className="text-xs text-[#aaa69e] leading-relaxed">
            You have received a shareable invitation to collaborate on RepoAutopsy.
          </p>

          {success ? (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 size={18} />
                <span>Successfully Joined {workspaceName}!</span>
              </div>
              <p className="text-xs text-[#77736c]">You now have collaborative access to repositories and reports.</p>
              <div className="pt-2">
                <Link
                  href={`/workspaces/${workspaceId}`}
                  className="inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-5 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                >
                  <span>Open Workspace</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ) : error ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-semibold">
                <AlertCircle size={16} />
                <span>Invitation Error</span>
              </div>
              <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
              <div className="pt-2">
                <Link
                  href="/workspaces"
                  className="inline-flex items-center gap-1.5 rounded border border-white/[.15] bg-white/[.04] px-4 py-2 text-xs font-medium text-white hover:bg-white/[.08]"
                >
                  <span>Go to Workspaces</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="pt-4 space-y-3">
              {isAuthenticated === false && (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                  You must be signed in with GitHub before accepting this invitation.
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={loading || isAuthenticated === false}
                className="w-full inline-flex items-center justify-center gap-2 rounded border border-amber-400/40 bg-amber-400 px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Joining Workspace…</span>
                  </>
                ) : (
                  <>
                    <span>Accept & Join Workspace</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
