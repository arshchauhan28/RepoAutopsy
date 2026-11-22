'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Sparkles, Trophy } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { TeamInviteJoin } from '@/components/codevitals/TeamInviteJoin'
import { AssessmentRunner } from '@/components/codevitals/AssessmentRunner'
import { AssessmentResults } from '@/components/codevitals/AssessmentResults'
import {
  getInterview,
  type AssessmentSession,
  type TeamInviteInfo,
  getTeamInviteInfo,
} from '@/lib/api'

export default function TeamInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const [inviteInfo, setInviteInfo] = useState<TeamInviteInfo | null>(null)
  const [session, setSession] = useState<AssessmentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!params.token) return
    getTeamInviteInfo(params.token)
      .then(info => setInviteInfo(info))
      .catch(e => setError(e?.message || 'Invalid or expired invite link'))
      .finally(() => setLoading(false))
  }, [params.token])

  const handleJoined = async (joinData: {
    team_session_id: string
    member_id: string
    assessment_session_id: string
    session_token?: string
  }) => {
    try {
      setLoading(true)
      if (typeof window !== 'undefined' && joinData.session_token) {
        localStorage.setItem(`repoautopsy-session-token-${joinData.assessment_session_id}`, joinData.session_token)
      }

      // If we have an analysis_id, navigate to the repo's codevitals view
      if (inviteInfo?.analysis_id) {
        router.push(
          `/repositories/${inviteInfo.analysis_id}/codevitals?session=${joinData.assessment_session_id}`
        )
        return
      }

      // Fallback: fetch session and run in-place
      const loaded = (await getInterview(joinData.assessment_session_id, joinData.session_token)) as unknown as AssessmentSession
      if (joinData.session_token && !loaded.session_token) {
        loaded.session_token = joinData.session_token
      }
      setSession(loaded)
    } catch (e: any) {
      setError(e?.message || 'Failed to start teammate assessment')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleted = (completedSession: AssessmentSession) => {
    setSession(completedSession)
  }

  const handleRetake = () => {
    setSession(null)
  }

  return (
    <div className="min-h-screen bg-[#0e0e0d] text-[#e8e4dc]">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 pb-20 sm:px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Loader2 size={32} className="animate-spin text-amber-400" />
            <p className="mt-4 font-mono text-xs text-[#8e8a82]">Loading CodeVitals team invitation…</p>
          </div>
        ) : error ? (
          <div className="mx-auto max-w-md rounded-xl border border-rose-500/20 bg-rose-500/[.05] p-6 text-center text-rose-300">
            <h2 className="text-base font-semibold">Invitation Error</h2>
            <p className="mt-2 text-xs text-rose-300/80">{error}</p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-white/[.1] bg-white/[.04] px-4 py-2 text-xs font-medium text-white hover:bg-white/[.08]"
            >
              <ArrowLeft size={14} /> Back to Home
            </Link>
          </div>
        ) : !session ? (
          <TeamInviteJoin inviteToken={params.token} onJoined={handleJoined} />
        ) : session.status === 'completed' ? (
          <AssessmentResults
            session={session}
            analysisId={inviteInfo?.analysis_id || ''}
            onRetake={handleRetake}
          />
        ) : (
          <AssessmentRunner
            session={session}
            onCompleted={handleCompleted}
            onExit={() => setSession(null)}
          />
        )}
      </main>
    </div>
  )
}
