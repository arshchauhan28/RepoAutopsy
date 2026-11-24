'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  GitBranch,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Layers,
  ExternalLink,
  BrainCircuit,
  FileText,
  GitPullRequest,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { ArchitectureMap } from '@/components/ArchitectureMap'
import { FindingList } from '@/components/FindingList'
import { AIReviewPanel } from '@/components/AIReviewPanel'
import { MetricCard } from '@/components/MetricCard'
import { StatusPill } from '@/components/StatusPill'
import { AnalyzePRModal } from '@/components/pull_request/AnalyzePRModal'
import { PRDashboard } from '@/components/pull_request/PRDashboard'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { Button } from '@/components/ui/Button'
import { getAnalysis, rerunAnalysis, type Analysis, type PullRequestAnalysis } from '@/lib/api'
import { groupFindings } from '@/lib/grouping'

export type SectionTab = 'overview' | 'anatomy' | 'diagnostics' | 'case-report' | 'codevitals'

function normalizeSectionHash(hash: string): SectionTab {
  const clean = hash.replace(/^#/, '').toLowerCase().trim()
  if (clean === 'architecture') return 'anatomy'
  if (clean === 'doctor') return 'diagnostics'
  if (clean === 'briefing' || clean === 'ai-review' || clean === 'ai-briefing') return 'case-report'
  if (clean === 'interview') return 'codevitals'
  if (['overview', 'anatomy', 'diagnostics', 'case-report', 'codevitals'].includes(clean)) {
    return clean as SectionTab
  }
  return 'overview'
}

export default function RepositoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionTab>('overview')
  const [diagnosticsCategory, setDiagnosticsCategory] = useState<string>('all')
  const [rerunning, setRerunning] = useState(false)
  const [isPRModalOpen, setIsPRModalOpen] = useState(false)
  const [activePR, setActivePR] = useState<PullRequestAnalysis | null>(null)
  const [workspaceMode, setWorkspaceMode] = useState<'snapshot' | 'pr'>('snapshot')

  async function load() {
    try {
      setAnalysis(await getAnalysis(params.id))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Unable to load repository')
    }
  }

  async function handleRerun() {
    if (!analysis) return
    setRerunning(true)
    try {
      const updated = await rerunAnalysis(analysis.id)
      setAnalysis(updated)
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Failed to re-run analysis')
    } finally {
      setRerunning(false)
    }
  }

  useEffect(() => {
    load()
  }, [params.id])

  useEffect(() => {
    if (!analysis || !['queued', 'running'].includes(analysis.status)) return
    const timer = setInterval(load, 2500)
    return () => clearInterval(timer)
  }, [analysis?.status, params.id])

  // Sync section with URL hash if present, including backward-compatible aliases
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const applyHash = () => {
        if (window.location.hash) {
          const target = normalizeSectionHash(window.location.hash)
          setActiveSection(target)
        }
      }
      applyHash()
      window.addEventListener('hashchange', applyHash)
      return () => window.removeEventListener('hashchange', applyHash)
    }
  }, [])

  const handleTabChange = (tab: SectionTab, category: string = 'all') => {
    setActiveSection(tab)
    if (category) {
      setDiagnosticsCategory(category)
    }
    if (typeof window !== 'undefined') {
      const newHash = tab === 'overview' ? '#overview' : `#${tab}`
      if (window.location.hash !== newHash) {
        window.history.pushState(null, '', window.location.pathname + newHash)
      }
    }
  }

  const metrics = analysis?.metrics || {}
  const findings = analysis?.findings || []
  const briefing = analysis?.ai_insights
  const recommendations = briefing?.recommendations || briefing?.top_recommendations || []

  // Group findings to get accurate distinct counts vs occurrences
  const { groupedIssues, counts } = useMemo(() => {
    return groupFindings(findings)
  }, [findings])

  const languages = useMemo(() => Object.entries(analysis?.languages || {}).slice(0, 6), [analysis])
  const primaryLang = languages[0] ? languages[0][0] : 'Polyglot'

  if (error)
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <ErrorState
            title="Unable to load repository"
            message={error}
            onRetry={load}
          />
        </main>
      </div>
    )

  if (!analysis)
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-white/[.06] animate-pulse" />
            <div className="h-4 w-72 rounded bg-white/[.04] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </div>
    )

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: analysis.owner },
    { label: analysis.repo_name },
  ]

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* BREADCRUMBS */}
        <Breadcrumbs items={breadcrumbs} />

        {/* REPOSITORY TOP HEADER */}
        <div className="reveal flex flex-col gap-4 border-b border-white/[.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-all text-2xl font-semibold tracking-tight sm:text-3xl text-white">
                {analysis.owner}/{analysis.repo_name}
              </h1>
              <StatusPill status={analysis.status} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <a
                className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300/80 transition hover:text-amber-300"
                href={analysis.github_url}
                target="_blank"
                rel="noreferrer"
              >
                {analysis.github_url}
                <ExternalLink size={10} className="opacity-70" />
              </a>

              <span className="text-[#55514b]">|</span>

              <span className="font-mono text-[11px] text-[#aaa69e]">
                Primary: <strong className="text-white">{primaryLang}</strong>
              </span>

              {analysis.default_branch && (
                <>
                  <span className="text-[#55514b]">|</span>
                  <span className="font-mono text-[11px] text-[#77736c]">
                    branch: {analysis.default_branch}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setIsPRModalOpen(true)}
              variant="secondary"
              size="sm"
              leftIcon={<GitPullRequest size={13} className="text-amber-400 shrink-0" />}
              title="Analyze a GitHub Pull Request for this repository"
              className="border-amber-400/30 hover:border-amber-400/50 justify-center min-h-[38px]"
            >
              Analyze PR
            </Button>

            <Link href={`/repositories/${analysis.id}/report`} className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FileText size={13} className="shrink-0" />}
                className="w-full justify-center min-h-[38px]"
              >
                Case Report
              </Button>
            </Link>

            <Button
              onClick={handleRerun}
              variant="outline"
              size="sm"
              isLoading={rerunning}
              disabled={['queued', 'running'].includes(analysis.status)}
              leftIcon={<RefreshCw size={13} className="shrink-0" />}
              title="Re-run analysis with current code and engine"
              className="justify-center min-h-[38px]"
            >
              {rerunning ? 'Starting…' : 'Re-run'}
            </Button>

            <Button
              onClick={load}
              variant="ghost"
              size="sm"
              className="justify-center min-h-[38px]"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* STALE ANALYZER VERSION NOTICE */}
        {analysis.status === 'completed' && (!analysis.analyzer_version || analysis.analyzer_version !== '2.2.0') && (
          <div className="card mt-6 border-amber-400/30 bg-amber-400/[.04] p-4 text-xs text-[#c8c4bc] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 reveal">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded text-[10px] font-bold">
                ANALYZER v{analysis.analyzer_version || '1.0.0'}
              </span>
              <span>
                This analysis was generated with an earlier engine version. Re-run analysis to apply the latest diagnostic rules, file classifications, and accurate recommendations.
              </span>
            </div>
            <button
              onClick={handleRerun}
              disabled={rerunning}
              className="inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={12} className={rerunning ? 'animate-spin' : ''} />
              <span>{rerunning ? 'Queuing…' : 'Re-run Fresh Analysis'}</span>
            </button>
          </div>
        )}

        {/* SCANNING PROGRESS OVERLAY */}
        {(analysis.status === 'queued' || analysis.status === 'running') && (
          <div className="card relative mt-6 overflow-hidden reveal">
            <div className="h-1 overflow-hidden bg-white/[.04]">
              <div className="h-full w-1/2 animate-[progressSweep_2.2s_ease-in-out_infinite] bg-amber-400" />
            </div>
            <div className="scan-overlay opacity-50" />
            <div className="relative p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-glow rounded-full bg-amber-400" />
                <h2 className="font-medium text-white">
                  {analysis.status === 'queued' ? 'Analysis queued' : 'Analyzing repository'}
                </h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77736c]">
                RepoAutopsy is ingesting files, running AST vulnerability scanners, extracting dependency graphs, and building the architectural briefing.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-4">
                {['Archive Ingested', 'Anatomy Parsed', 'Diagnostics Grouped', 'Case Report Ready'].map((x, i) => (
                  <div key={x} className="border border-white/[.07] bg-white/[.02] p-3 text-xs text-[#77736c]">
                    <span className="mr-2 font-mono text-amber-400">0{i + 1}</span>
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FAILED STATE */}
        {analysis.status === 'failed' && (
          <div className="mt-6 border border-rose-400/20 bg-rose-400/[.04] p-4 text-sm leading-6 text-rose-300 reveal">
            {analysis.error || 'The analysis failed.'}
          </div>
        )}

        {/* COMPLETED DASHBOARD CONTENT */}
        {analysis.status === 'completed' && (
          <div className="mt-6 space-y-8">
            {/* PR MODE CONTEXT BAR (if a PR has been analyzed) */}
            {activePR && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-3 text-xs text-indigo-200">
                <div className="flex items-center gap-2.5">
                  <GitPullRequest size={15} className="text-indigo-400 shrink-0" />
                  <span>
                    Viewing Autopsy for <strong>PR #{activePR.pr_number}: {activePR.pr_title}</strong>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    activePR.review_priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                    activePR.review_priority === 'medium' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {activePR.review_priority.toUpperCase()} PRIORITY
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWorkspaceMode(workspaceMode === 'pr' ? 'snapshot' : 'pr')}
                    className="rounded border border-indigo-400/40 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500/30 transition"
                  >
                    {workspaceMode === 'pr' ? 'Switch to Repo Snapshot' : 'Switch to PR Autopsy'}
                  </button>
                  <button
                    onClick={() => { setActivePR(null); setWorkspaceMode('snapshot'); }}
                    className="rounded border border-white/10 px-2.5 py-1.5 text-xs text-[#77736c] hover:text-white transition"
                  >
                    Close PR
                  </button>
                </div>
              </div>
            )}

            {workspaceMode === 'pr' && activePR ? (
              <PRDashboard pr={activePR} onBackToRepo={() => setWorkspaceMode('snapshot')} />
            ) : (
              <>
                {/* CANONICAL 5-SECTION NAVIGATION BAR: Overview | Anatomy | Diagnostics | Case Report | CodeVitals */}
                <nav className="sticky top-14 z-30 flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto rounded-xl border border-white/[.12] bg-[#0c0f13]/95 p-1.5 shadow-xl backdrop-blur-md no-scrollbar">
              <div className="flex items-center gap-1 min-w-max">
                <button
                  onClick={() => handleTabChange('overview')}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition shrink-0 ${
                    activeSection === 'overview'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
                  }`}
                >
                  <span>Overview</span>
                </button>

                <button
                  onClick={() => handleTabChange('anatomy')}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition shrink-0 ${
                    activeSection === 'anatomy'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
                  }`}
                >
                  <Layers size={13} />
                  <span>Anatomy</span>
                </button>

                <button
                  onClick={() => handleTabChange('diagnostics')}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition shrink-0 ${
                    activeSection === 'diagnostics'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
                  }`}
                >
                  <ShieldAlert size={13} />
                  <span>Diagnostics</span>
                  {counts.distinct.totalHighPriority > 0 && (
                    <span
                      className={`rounded px-1.5 py-0.2 font-mono text-[9px] ${
                        activeSection === 'diagnostics'
                          ? 'bg-black/20 text-black'
                          : 'bg-rose-500/20 text-rose-300 font-bold'
                      }`}
                    >
                      {counts.distinct.totalHighPriority}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleTabChange('case-report')}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition shrink-0 ${
                    activeSection === 'case-report'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>Case Report</span>
                </button>

                <button
                  onClick={() => handleTabChange('codevitals')}
                  className={`flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition shrink-0 ${
                    activeSection === 'codevitals'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
                  }`}
                >
                  <BrainCircuit size={13} />
                  <span>CodeVitals</span>
                </button>
              </div>

              <div className="hidden items-center gap-2 pr-2 text-[11px] font-mono text-[#77736c] md:flex">
                <span>{metrics.total_files || 0} files</span>
                <span>·</span>
                <span>{(metrics.code_lines || 0).toLocaleString()} loc</span>
              </div>
            </nav>

            {/* ========================================================= */}
            {/* SECTION 01 — OVERVIEW */}
            {/* ========================================================= */}
            {activeSection === 'overview' && (
              <section id="overview" className="space-y-4 reveal">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
                    Section 01 / Overview
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard
                    label="Files"
                    value={metrics.total_files || 0}
                  />

                  <MetricCard
                    label="Code lines"
                    value={(metrics.code_lines || 0).toLocaleString()}
                  />

                  <MetricCard
                    label="Functions"
                    value={metrics.functions || 0}
                  />

                  {/* Security Issues Metric - Clickable to open Diagnostics filtered to Security */}
                  <div
                    onClick={() => handleTabChange('diagnostics', 'security')}
                    className="cursor-pointer transition hover:opacity-90 active:scale-[.99]"
                    title="Click to view Security Issues in Diagnostics"
                  >
                    <MetricCard
                      label="Security Issues"
                      value={counts.distinct.security}
                      detail={`${counts.occurrences.security} occurrence${counts.occurrences.security === 1 ? '' : 's'}`}
                    />
                  </div>

                  {/* Code Quality Issues Metric - Clickable to open Diagnostics filtered to Quality */}
                  <div
                    onClick={() => handleTabChange('diagnostics', 'quality')}
                    className="cursor-pointer transition hover:opacity-90 active:scale-[.99]"
                    title="Click to view Code Quality Issues in Diagnostics"
                  >
                    <MetricCard
                      label="Code Quality Issues"
                      value={counts.distinct.quality}
                      detail={`${counts.occurrences.quality} occurrence${counts.occurrences.quality === 1 ? '' : 's'}`}
                    />
                  </div>
                </div>

                {/* Stack, Organization & Quick Actions */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="card p-4 sm:col-span-2">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                      Repository Context
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#c8c4bc]">
                      {briefing?.project_overview?.summary || analysis.summary || 'Repository analysis completed.'}
                    </p>
                    {languages.length > 0 && (
                      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-[#77736c]">Languages:</span>
                        {languages.map(([name, count]) => (
                          <span
                            key={name}
                            className="rounded border border-white/[.08] bg-white/[.03] px-2 py-0.5 font-mono text-[10px] text-[#aaa69e]"
                          >
                            {name} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card flex flex-col justify-between p-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                        Quick Actions
                      </div>
                      <div className="mt-3 space-y-2 text-xs">
                        <button
                          onClick={() => setIsPRModalOpen(true)}
                          className="flex w-full items-center justify-between rounded border border-indigo-500/30 bg-indigo-500/[.05] p-2 text-left text-indigo-200 hover:border-indigo-400/60 hover:text-white transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <GitPullRequest size={12} className="text-indigo-400" />
                            Analyze Pull Request
                          </span>
                          <ArrowRight size={13} className="text-indigo-400" />
                        </button>
                        <button
                          onClick={() => handleTabChange('diagnostics', 'all')}
                          className="flex w-full items-center justify-between rounded border border-white/[.07] bg-white/[.02] p-2 text-left text-[#c8c4bc] hover:border-amber-400/40 hover:text-white transition"
                        >
                          <span>View Diagnostics</span>
                          <ArrowRight size={13} className="text-amber-400" />
                        </button>
                        <button
                          onClick={() => handleTabChange('anatomy')}
                          className="flex w-full items-center justify-between rounded border border-white/[.07] bg-white/[.02] p-2 text-left text-[#c8c4bc] hover:border-amber-400/40 hover:text-white transition"
                        >
                          <span>Explore Anatomy</span>
                          <ArrowRight size={13} className="text-amber-400" />
                        </button>
                      </div>
                    </div>

                    <Link
                      href={`/repositories/${analysis.id}/codevitals`}
                      className="mt-3 flex items-center justify-center gap-1.5 rounded border border-amber-400/40 bg-amber-400/10 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition"
                    >
                      <BrainCircuit size={13} />
                      <span>Start CodeVitals</span>
                    </Link>
                  </div>
                </div>

                {/* Evidence-Based Analysis Coverage Card */}
                {analysis.architecture?.coverage && (
                  <div className="card p-5 border-white/[.12] bg-[#0c0f13] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.08] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400 font-semibold">
                          Analysis Coverage & Evidence
                        </span>
                        {analysis.commit_sha && (
                          <span className="rounded bg-white/[.04] px-2 py-0.5 font-mono text-[10px] text-[#aaa69e] border border-white/[.08]">
                            SHA: {analysis.commit_sha.slice(0, 7)}
                          </span>
                        )}
                        <span className="rounded bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-400/30">
                          v{analysis.analyzer_version || '2.2.0'}
                        </span>
                      </div>
                      <span className="text-xs text-[#77736c] font-mono">
                        {analysis.architecture.coverage.is_partial ? 'Partial Coverage' : 'Verified Repository Scope'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                      <div className="rounded border border-white/[.06] bg-white/[.02] p-3 text-center">
                        <div className="text-xs text-[#77736c]">Total Inventoried</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-white">
                          {analysis.architecture.coverage.total_discovered_files || metrics.total_files || 0}
                        </div>
                      </div>
                      <div className="rounded border border-white/[.06] bg-white/[.02] p-3 text-center">
                        <div className="text-xs text-[#77736c]">Eligible Source</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-amber-400">
                          {analysis.architecture.coverage.eligible_source_files ?? (metrics.first_party_source_files || metrics.total_files || 0)}
                        </div>
                      </div>
                      <div className="rounded border border-emerald-500/20 bg-emerald-500/[.03] p-3 text-center">
                        <div className="text-xs text-emerald-300/80">AST Parsed</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-emerald-400">
                          {analysis.architecture.coverage.successfully_parsed ?? metrics.first_party_source_files ?? 0}
                        </div>
                      </div>
                      <div className="rounded border border-blue-500/20 bg-blue-500/[.03] p-3 text-center">
                        <div className="text-xs text-blue-300/80">Partially Analyzed</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-blue-400">
                          {analysis.architecture.coverage.partially_analyzed ?? 0}
                        </div>
                      </div>
                      <div className="rounded border border-white/[.06] bg-white/[.02] p-3 text-center">
                        <div className="text-xs text-[#77736c]">Unsupported / Skipped</div>
                        <div className="mt-1 font-mono text-lg font-semibold text-[#8b867d]">
                          {(analysis.architecture.coverage.unsupported_files || 0) + (analysis.architecture.coverage.skipped_files || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ========================================================= */}
            {/* SECTION 02 — ANATOMY (Codebase Anatomy) */}
            {/* ========================================================= */}
            {activeSection === 'anatomy' && (
              <section id="anatomy" className="space-y-3 reveal">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
                      Section 02 / Codebase Anatomy
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-white">Codebase Anatomy</h2>
                    <p className="mt-1 text-xs text-[#77736c]">
                      Explore your repository's structure, components, and dependencies.
                    </p>
                  </div>
                  <GitBranch className="hidden text-[#8b867d] sm:block" size={19} />
                </div>

                <ArchitectureMap
                  architecture={analysis.architecture}
                  owner={analysis.owner}
                  repo={analysis.repo_name}
                  defaultBranch={analysis.default_branch}
                  findings={findings}
                  onSelectFindingCategory={(cat) => handleTabChange('diagnostics', cat)}
                />
              </section>
            )}

            {/* ========================================================= */}
            {/* SECTION 03 — DIAGNOSTICS */}
            {/* ========================================================= */}
            {activeSection === 'diagnostics' && (
              <section id="diagnostics" className="space-y-3 reveal">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
                      Section 03 / Diagnostics
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-white">Diagnostics</h2>
                    <p className="mt-1 text-xs text-[#77736c]">
                      Identify important issues and discover evidence-backed improvements.
                    </p>
                  </div>
                  <ShieldAlert className="hidden text-amber-300 sm:block" size={19} />
                </div>

                <FindingList
                  findings={findings}
                  recommendations={recommendations}
                  owner={analysis.owner}
                  repo={analysis.repo_name}
                  defaultBranch={analysis.default_branch}
                  initialCategory={diagnosticsCategory}
                />
              </section>
            )}

            {/* ========================================================= */}
            {/* SECTION 04 — CASE REPORT */}
            {/* ========================================================= */}
            {activeSection === 'case-report' && (
              <section id="case-report" className="space-y-3 reveal">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
                      Section 04 / Case Report
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-white">Case Report</h2>
                    <p className="mt-1 text-xs text-[#77736c]">
                      An evidence-backed technical assessment of your repository.
                    </p>
                  </div>
                  <Sparkles className="hidden text-amber-300 sm:block" size={19} />
                </div>

                <AIReviewPanel
                  analysis={analysis}
                  onNavigateToDiagnostics={() => handleTabChange('diagnostics', 'all')}
                />
              </section>
            )}

            {/* ========================================================= */}
            {/* SECTION 05 — CODEVITALS */}
            {/* ========================================================= */}
            {activeSection === 'codevitals' && (
              <section id="codevitals" className="rounded-xl border border-white/[.1] bg-[#0d0f12] p-6 sm:p-8 space-y-6 reveal">
                <div className="max-w-3xl space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-amber-400">
                    <BrainCircuit size={16} />
                    <span>Section 05 / CodeVitals Assessment</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-white">
                    Defend your codebase knowledge
                  </h2>
                  <p className="text-sm leading-relaxed text-[#9ca3af]">
                    CodeVitals evaluates your architectural comprehension, component boundary knowledge, and failure mode defenses through personalized technical questions generated directly from this repository's syntax tree and dependency graph.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                  <div className="rounded-lg border border-white/[.08] bg-black/20 p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">Mode 01</span>
                    <h4 className="text-sm font-semibold text-white">Complete Codebase</h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">Broad assessment across all modules, dependencies, and lifecycle flows.</p>
                  </div>
                  <div className="rounded-lg border border-white/[.08] bg-black/20 p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">Mode 02</span>
                    <h4 className="text-sm font-semibold text-white">Component-Scoped</h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">Deep dive targeted at specific services, APIs, or subsystem boundaries.</p>
                  </div>
                  <div className="rounded-lg border border-white/[.08] bg-black/20 p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">Mode 03</span>
                    <h4 className="text-sm font-semibold text-white">Team Evaluation</h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">Collaborative assessment with teammate invites and readiness heatmaps.</p>
                  </div>
                  <div className="rounded-lg border border-white/[.08] bg-black/20 p-4 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">Mode 04</span>
                    <h4 className="text-sm font-semibold text-white">Hackathon Readiness</h4>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">High-tempo evaluation preparing your team for rapid code defense.</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/[.08]">
                  <Link href={`/repositories/${analysis.id}/codevitals`}>
                    <Button variant="primary" size="md" rightIcon={<ArrowRight size={14} />}>
                      Enter CodeVitals Suite
                    </Button>
                  </Link>
                  <Link href={`/repositories/${analysis.id}/report`}>
                    <Button variant="secondary" size="md" leftIcon={<FileText size={14} />}>
                      Review Case Report
                    </Button>
                  </Link>
                </div>
              </section>
            )}
            </>
          )}
        </div>
      )}

      {/* ANALYZE PULL REQUEST MODAL */}
      <AnalyzePRModal
        isOpen={isPRModalOpen}
        onClose={() => setIsPRModalOpen(false)}
        onSuccess={(pr) => {
          setActivePR(pr)
          setWorkspaceMode('pr')
        }}
        repositoryId={analysis?.id}
        defaultOwner={analysis?.owner}
        defaultRepo={analysis?.repo_name}
      />
    </main>
  </div>
)
}
