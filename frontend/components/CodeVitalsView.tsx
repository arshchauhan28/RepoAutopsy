'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, BrainCircuit, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { CodeVitalsLanding } from '@/components/codevitals/CodeVitalsLanding'
import { CompleteAssessmentConfig } from '@/components/codevitals/CompleteAssessmentConfig'
import { ComponentAssessmentConfig } from '@/components/codevitals/ComponentAssessmentConfig'
import { TeamSessionCreate } from '@/components/codevitals/TeamSessionCreate'
import { TeamDashboard } from '@/components/codevitals/TeamDashboard'
import { AssessmentRunner } from '@/components/codevitals/AssessmentRunner'
import { AssessmentResults } from '@/components/codevitals/AssessmentResults'
import {
  getAnalysis,
  getInterview,
  startAssessment,
  startPracticeSession,
  retakeAssessment,
  getAssessmentHistory,
  getTeamSessionsForRepo,
  type Analysis,
  type AssessmentSession,
} from '@/lib/api'

type CodeVitalsMode =
  | 'landing'
  | 'complete_config'
  | 'component_config'
  | 'team_create'
  | 'team_dashboard'
  | 'runner'
  | 'results'

export function CodeVitalsView() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [view, setView] = useState<CodeVitalsMode>('landing')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [currentSession, setCurrentSession] = useState<AssessmentSession | null>(null)
  const [activeTeamSessionId, setActiveTeamSessionId] = useState<string | null>(null)
  const [organizerToken, setOrganizerToken] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<any[]>([])
  const [teamSessions, setTeamSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [insufficientPrompt, setInsufficientPrompt] = useState<{
    requestedCount: number
    availableCount: number
    message: string
    configPayload: any
  } | null>(null)

  const refreshHistoryAndTeams = useCallback(async (analysisId: string) => {
    try {
      const [hist, teams] = await Promise.all([
        getAssessmentHistory(analysisId).catch(() => []),
        getTeamSessionsForRepo(analysisId).catch(() => []),
      ])
      setHistory(hist || [])
      setTeamSessions(teams || [])
    } catch {
      // Non-fatal
    }
  }, [])

  useEffect(() => {
    if (!params.id) return

    let isMounted = true
    ;(async () => {
      try {
        setLoading(true)
        const a = await getAnalysis(params.id)
        if (!isMounted) return
        setAnalysis(a)

        await refreshHistoryAndTeams(params.id)

        // Check search parameters for direct session or team loading
        const sessionIdParam = searchParams.get('session')
        const teamIdParam = searchParams.get('team')

        if (sessionIdParam) {
          try {
            const storedToken =
              typeof window !== 'undefined'
                ? localStorage.getItem(`repoautopsy-session-token-${sessionIdParam}`) || undefined
                : undefined
            const sess = (await getInterview(sessionIdParam, storedToken)) as unknown as AssessmentSession
            if (isMounted) {
              if (storedToken && !sess.session_token) sess.session_token = storedToken
              setCurrentSession(sess)
              setView(sess.status === 'completed' ? 'results' : 'runner')
              return
            }
          } catch {
            // Ignore param error and fallback
          }
        } else if (teamIdParam) {
          const orgToken =
            typeof window !== 'undefined'
              ? localStorage.getItem(`repoautopsy-team-org-${teamIdParam}`) || undefined
              : undefined
          setActiveTeamSessionId(teamIdParam)
          setOrganizerToken(orgToken)
          setView('team_dashboard')
          return
        }

        // Check localStorage for previously active session
        const storedSessionId =
          typeof window !== 'undefined'
            ? localStorage.getItem(`repoautopsy-codevitals-${params.id}`)
            : null

        if (storedSessionId) {
          try {
            const storedToken =
              typeof window !== 'undefined'
                ? localStorage.getItem(`repoautopsy-session-token-${storedSessionId}`) || undefined
                : undefined
            const sess = (await getInterview(storedSessionId, storedToken)) as unknown as AssessmentSession
            if (sess && sess.status === 'active' && isMounted) {
              if (storedToken && !sess.session_token) sess.session_token = storedToken
              setCurrentSession(sess)
              setView('runner')
            }
          } catch {
            // Expired or invalid session
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to load repository details')
      } finally {
        if (isMounted) setLoading(false)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [params.id, searchParams, refreshHistoryAndTeams])

  // Handle Option selection from Landing screen
  const handleSelectOption = (option: 'complete' | 'component' | 'team') => {
    setError('')
    if (option === 'complete') {
      setView('complete_config')
    } else if (option === 'component') {
      setView('component_config')
    } else if (option === 'team') {
      setView('team_create')
    }
  }

  // Handle Starting Complete Assessment
  const handleStartComplete = async (config: {
    questionCount: number
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    participantName?: string
  }) => {
    if (!analysis) return
    setStarting(true)
    setError('')
    setInsufficientPrompt(null)
    const payload = {
      assessment_type: 'complete',
      scope_type: 'complete',
      question_count: config.questionCount,
      difficulty: config.difficulty,
      participant_name: config.participantName || undefined,
    }
    try {
      const session = await startAssessment(analysis.id, payload)
      setCurrentSession(session)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`repoautopsy-codevitals-${analysis.id}`, session.id)
        if (session.session_token) {
          localStorage.setItem(`repoautopsy-session-token-${session.id}`, session.session_token)
        }
      }
      setView('runner')
    } catch (err: any) {
      if (err?.detail?.status === 'insufficient_questions') {
        setInsufficientPrompt({
          requestedCount: err.detail.requested_count,
          availableCount: err.detail.available_count,
          message: err.detail.message,
          configPayload: {
            ...payload,
            allow_shorter: true,
            question_count: err.detail.available_count,
          },
        })
        return
      }
      setError(err?.message || 'Failed to generate Complete Codebase assessment')
    } finally {
      setStarting(false)
    }
  }

  // Handle Starting Component Assessment
  const handleStartComponent = async (config: {
    selectedComponents: string[]
    questionCount: number
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    participantName?: string
  }) => {
    if (!analysis) return
    setStarting(true)
    setError('')
    setInsufficientPrompt(null)
    const payload = {
      assessment_type: 'component',
      scope_type: 'component',
      selected_components: config.selectedComponents,
      question_count: config.questionCount,
      difficulty: config.difficulty,
      participant_name: config.participantName || undefined,
    }
    try {
      const session = await startAssessment(analysis.id, payload)
      setCurrentSession(session)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`repoautopsy-codevitals-${analysis.id}`, session.id)
        if (session.session_token) {
          localStorage.setItem(`repoautopsy-session-token-${session.id}`, session.session_token)
        }
      }
      setView('runner')
    } catch (err: any) {
      if (err?.detail?.status === 'insufficient_questions') {
        setInsufficientPrompt({
          requestedCount: err.detail.requested_count,
          availableCount: err.detail.available_count,
          message: err.detail.message,
          configPayload: {
            ...payload,
            allow_shorter: true,
            question_count: err.detail.available_count,
          },
        })
        return
      }
      setError(err?.message || 'Failed to generate Component assessment')
    } finally {
      setStarting(false)
    }
  }

  // Handle Proceeding with Available Verified Questions
  const handleProceedWithAvailable = async () => {
    if (!analysis || !insufficientPrompt) return
    setStarting(true)
    setError('')
    try {
      const session = await startAssessment(analysis.id, insufficientPrompt.configPayload)
      setCurrentSession(session)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`repoautopsy-codevitals-${analysis.id}`, session.id)
        if (session.session_token) {
          localStorage.setItem(`repoautopsy-session-token-${session.id}`, session.session_token)
        }
      }
      setInsufficientPrompt(null)
      setView('runner')
    } catch (err: any) {
      setError(err?.message || 'Failed to start assessment with available questions')
    } finally {
      setStarting(false)
    }
  }

  // Handle Team Session Created
  const handleTeamCreated = (teamData: {
    id: string
    organizer_token: string
    invite_token: string
  }) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`repoautopsy-team-org-${teamData.id}`, teamData.organizer_token)
    }
    setActiveTeamSessionId(teamData.id)
    setOrganizerToken(teamData.organizer_token)
    setView('team_dashboard')
    if (analysis) refreshHistoryAndTeams(analysis.id)
  }

  // Open past individual session
  const handleOpenSession = async (sessionId: string) => {
    setLoading(true)
    setError('')
    try {
      const storedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem(`repoautopsy-session-token-${sessionId}`) || undefined
          : undefined
      const sess = (await getInterview(sessionId, storedToken)) as unknown as AssessmentSession
      if (storedToken && !sess.session_token) sess.session_token = storedToken
      setCurrentSession(sess)
      setView(sess.status === 'completed' ? 'results' : 'runner')
    } catch (err: any) {
      setError(err?.message || 'Unable to open assessment session')
    } finally {
      setLoading(false)
    }
  }

  // Open past team dashboard
  const handleOpenTeamDashboard = (teamSessionId: string) => {
    const orgToken =
      typeof window !== 'undefined'
        ? localStorage.getItem(`repoautopsy-team-org-${teamSessionId}`) || undefined
        : undefined
    setActiveTeamSessionId(teamSessionId)
    setOrganizerToken(orgToken)
    setView('team_dashboard')
  }

  // When assessment is finished
  const handleAssessmentCompleted = (updatedSession: AssessmentSession) => {
    setCurrentSession(updatedSession)
    setView('results')
    if (analysis) refreshHistoryAndTeams(analysis.id)
  }

  // Retake or return to landing
  const handleRetake = () => {
    setCurrentSession(null)
    if (analysis && typeof window !== 'undefined') {
      localStorage.removeItem(`repoautopsy-codevitals-${analysis.id}`)
    }
    setView('landing')
  }

  // Start Practice Mode from completed session
  const handleStartPractice = async (sessionId: string) => {
    setStarting(true)
    setError('')
    try {
      const storedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem(`repoautopsy-session-token-${sessionId}`) || undefined
          : undefined
      const practiceSession = await startPracticeSession(sessionId, storedToken)
      setCurrentSession(practiceSession)
      if (typeof window !== 'undefined' && practiceSession.session_token) {
        localStorage.setItem(`repoautopsy-session-token-${practiceSession.id}`, practiceSession.session_token)
      }
      setView('runner')
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize Practice Mode.')
    } finally {
      setStarting(false)
    }
  }

  // Exit runner back to landing
  const handleExitRunner = () => {
    setView('landing')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0d] text-[#e8e4dc]">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6">
          <Loader2 size={32} className="mx-auto animate-spin text-amber-400" />
          <p className="mt-4 font-mono text-xs uppercase tracking-wider text-[#8e8a82]">
            Loading CodeVitals Subsystem…
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0e0e0d] text-[#e8e4dc]">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-7 pb-20 sm:px-6 sm:py-10">
        {/* TOP BREADCRUMB / REPO BAR */}
        <div className="flex items-center justify-between border-b border-white/[.08] pb-4">
          <Link
            href={`/repositories/${params.id}`}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#77736c] transition hover:text-white"
          >
            <ArrowLeft size={14} /> Back to Repository Overview
          </Link>

          {analysis && (
            <div className="font-mono text-xs text-[#8e8a82]">
              <span className="text-[#55514b]">{analysis.owner} / </span>
              <span className="font-semibold text-white">{analysis.repo_name}</span>
            </div>
          )}
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/[.06] p-4 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* DYNAMIC VIEW ROUTER */}
        <div className="mt-6">
          {view === 'landing' && (
            <CodeVitalsLanding
              analysis={analysis}
              onSelectOption={handleSelectOption}
              history={history}
              teamSessions={teamSessions}
              onOpenSession={handleOpenSession}
              onOpenTeamDashboard={handleOpenTeamDashboard}
            />
          )}

          {view === 'complete_config' && (
            <CompleteAssessmentConfig
              analysis={analysis}
              onBack={() => setView('landing')}
              onStart={handleStartComplete}
              loading={starting}
            />
          )}

          {view === 'component_config' && (
            <ComponentAssessmentConfig
              analysis={analysis}
              onBack={() => setView('landing')}
              onStart={handleStartComponent}
              loading={starting}
            />
          )}

          {view === 'team_create' && (
            <TeamSessionCreate
              analysis={analysis}
              onBack={() => setView('landing')}
              onCreated={handleTeamCreated}
            />
          )}

          {view === 'team_dashboard' && activeTeamSessionId && (
            <TeamDashboard
              teamSessionId={activeTeamSessionId}
              organizerToken={organizerToken}
              onBack={() => {
                setActiveTeamSessionId(null)
                setView('landing')
                if (analysis) refreshHistoryAndTeams(analysis.id)
              }}
              onOpenMemberAssessment={handleOpenSession}
            />
          )}

          {view === 'runner' && currentSession && (
            <AssessmentRunner
              session={currentSession}
              onCompleted={handleAssessmentCompleted}
              onExit={handleExitRunner}
            />
          )}

          {view === 'results' && currentSession && (
            <AssessmentResults
              session={currentSession}
              analysisId={params.id}
              onRetake={handleRetake}
              onStartPractice={handleStartPractice}
              onViewTeamDashboard={
                currentSession.team_session_id
                  ? () => handleOpenTeamDashboard(currentSession.team_session_id!)
                  : undefined
              }
            />
          )}
        </div>

        {/* INSUFFICIENT EVIDENCE MODAL */}
        {insufficientPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="card max-w-md w-full p-6 border border-amber-400/30 bg-[#121214] shadow-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
                <AlertTriangle size={18} className="shrink-0" />
                <span>Evidence Limitation Discovered</span>
              </div>
              <p className="text-xs text-[#dcd8d0] leading-relaxed">
                {insufficientPrompt.message}
              </p>
              <div className="p-3 rounded bg-white/[.03] border border-white/[.08] text-[11px] text-[#aaa69e] space-y-1">
                <div>Requested: <strong className="text-white">{insufficientPrompt.requestedCount} questions</strong></div>
                <div>Verified Evidence: <strong className="text-amber-400">{insufficientPrompt.availableCount} questions</strong></div>
                <div className="text-[10px] text-[#8e8a82] mt-1">RepoAutopsy generates questions backed by repository source evidence and transparently pauses if evidence is insufficient to reach the target count.</div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInsufficientPrompt(null)}
                  className="px-3 py-1.5 rounded text-xs text-[#aaa69e] hover:text-white border border-white/[.1] transition"
                >
                  Adjust Options
                </button>
                <button
                  type="button"
                  disabled={starting}
                  onClick={handleProceedWithAvailable}
                  className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-400 text-black hover:bg-amber-300 transition flex items-center gap-1.5"
                >
                  {starting ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>Proceed with {insufficientPrompt.availableCount} Qs</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
