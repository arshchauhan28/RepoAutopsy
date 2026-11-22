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
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { ArchitectureMap } from '@/components/ArchitectureMap'
import { FindingList } from '@/components/FindingList'
import { AIReviewPanel } from '@/components/AIReviewPanel'
import { MetricCard } from '@/components/MetricCard'
import { StatusPill } from '@/components/StatusPill'
import { getAnalysis, rerunAnalysis, type Analysis } from '@/lib/api'
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
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="card border-rose-400/20 bg-rose-400/[.04] p-6 text-sm text-rose-300 reveal">{error}</div>
        </main>
      </div>
    )

  if (!analysis)
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-16 text-sm text-[#77736c] sm:px-6 sm:py-20">Loading repository…</main>
      </div>
    )

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8">
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

          <div className="flex items-center gap-2">
            <Link
              href={`/repositories/${analysis.id}/report`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded border border-white/[.1] px-3.5 py-2 text-xs font-medium text-[#c8c4bc] transition hover:bg-white/[.04]"
            >
              <FileText size={13} />
              Case Report
            </Link>

            <button
              onClick={handleRerun}
              disabled={rerunning || ['queued', 'running'].includes(analysis.status)}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded border border-white/[.1] px-3.5 py-2 text-xs font-medium text-[#aaa69e] transition hover:bg-white/[.04] disabled:opacity-40"
              title="Re-run analysis with current code and engine"
            >
              <RefreshCw size={13} className={rerunning ? 'animate-spin' : ''} />
              {rerunning ? 'Starting…' : 'Re-run'}
            </button>

            <button
              onClick={load}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded border border-white/[.1] px-3.5 py-2 text-xs font-medium text-[#aaa69e] transition hover:bg-white/[.04]"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* STALE ANALYZER VERSION NOTICE */}
        {analysis.status === 'completed' && (!analysis.analyzer_version || analysis.analyzer_version !== '2.1.0') && (
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
            {/* CANONICAL 5-SECTION NAVIGATION BAR: Overview | Anatomy | Diagnostics | Case Report | CodeVitals */}
            <nav className="sticky top-0 z-30 flex items-center justify-between gap-2 overflow-x-auto rounded-xl border border-white/[.12] bg-[#0c0f13]/95 p-1.5 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-1 min-w-max">
                <button
                  onClick={() => handleTabChange('overview')}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    activeSection === 'overview'
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
                  }`}
                >
                  <span>Overview</span>
                </button>

                <button
                  onClick={() => handleTabChange('anatomy')}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
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
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
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
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
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
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
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
              <section id="codevitals" className="card p-6 sm:p-8 reveal">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-emerald-400">
                    <BrainCircuit size={16} />
                    <span>Section 05 / CodeVitals</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    How well do you know your codebase?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#aaa69e]">
                    Test your understanding of the repository through personalized technical questions and discover areas where your knowledge can improve. Answer questions on system architecture, component tradeoffs, and failure modes to receive comprehensive evaluation and feedback.
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/repositories/${analysis.id}/codevitals`}
                      className="group inline-flex min-h-11 items-center justify-center gap-2 border border-amber-400/40 bg-amber-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
                    >
                      <span>Start CodeVitals</span>
                      <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>

                    <Link
                      href={`/repositories/${analysis.id}/report`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-white/[.12] bg-white/[.03] px-5 py-3 text-sm font-medium text-[#c8c4bc] hover:bg-white/[.07] hover:text-white"
                    >
                      <FileText size={14} />
                      <span>View Case Report</span>
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
