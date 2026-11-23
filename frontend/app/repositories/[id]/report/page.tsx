'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import {
  ArrowLeft,
  Download,
  FileText,
  ShieldAlert,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  Layers,
  Flame,
  Bug,
  Info,
  ExternalLink,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { getReport } from '@/lib/api'
import { groupFindings } from '@/lib/grouping'

export default function ReportPage() {
  const params = useParams<{ id: string }>()
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getReport(params.id)
      .then(setReport)
      .catch(e => setError(e.message || 'Unable to load report'))
  }, [params.id])

  const findings = report?.findings || []
  const { groupedIssues, counts } = useMemo(() => {
    return groupFindings(findings)
  }, [findings])

  if (error)
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <ErrorState
            title="Unable to load report"
            message={error}
            onRetry={() => window.location.reload()}
          />
        </main>
      </div>
    )

  if (!report)
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 space-y-6">
          <div className="h-6 w-48 rounded bg-white/[.06] animate-pulse" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </div>
    )

  const briefing = report.briefing || report.ai_insights || {}
  const rawRecs = report.recommendations || briefing.recommendations || briefing.top_recommendations || []
  // Filter out any false positive lockfile recommendations from historical snapshots
  const recommendations = rawRecs.filter((r: any) => {
    const text = `${r.title || ''} ${r.evidence || ''}`.toLowerCase()
    return !text.includes('package-lock') && !text.includes('yarn.lock') && !text.includes('pnpm-lock')
  })

  const explanation =
    briefing.architecture_explanation ||
    briefing.architecture_assessment?.component_relationships ||
    briefing.summary ||
    report.summary

  const metrics = report.metrics || {}
  const languages = Object.entries(metrics.languages || {}).slice(0, 5)
  const components = report.architecture?.components || []
  const coverage = report.architecture?.coverage
  const interview = report.interview

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: report.repository.owner },
    { label: report.repository.name, href: `/repositories/${params.id}` },
    { label: 'Case Report' },
  ]

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-7 pb-20 sm:px-6 sm:py-10 sm:pb-24 space-y-6">
        {/* Navigation & Print Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Breadcrumbs items={breadcrumbs} />

          <Button
            onClick={() => window.print()}
            variant="secondary"
            size="sm"
            leftIcon={<Download size={14} />}
            className="print-hide shrink-0"
          >
            Print / Save PDF Report
          </Button>
        </div>

        {/* 1. REPOSITORY SUMMARY HEADER */}
        <div className="mt-8 border-b border-white/[.08] pb-7 reveal">
          <div className="flex items-center gap-2 text-amber-300">
            <FileText size={18} />
            <span className="font-mono text-[10px] uppercase tracking-[.16em]">Repository Case Report</span>
          </div>
          <h1 className="mt-2 break-all text-2xl font-semibold tracking-tight sm:text-4xl text-white">
            {report.repository.owner}/{report.repository.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aaa69e]">{report.summary}</p>

          {/* Core Metrics Banner */}
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="card p-4">
              <div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#77736c]">Files Analyzed</div>
              <div className="mt-2 text-2xl font-semibold text-white">{metrics.total_files || 0}</div>
              <div className="mt-0.5 text-[10px] text-[#77736c]">
                {coverage ? `${coverage.eligible_source_files ?? metrics.first_party_source_files ?? metrics.total_files} eligible / ${coverage.successfully_parsed ?? metrics.first_party_source_files ?? metrics.total_files} parsed` : 'Complete Scope'}
              </div>
            </div>

            <div className="card p-4">
              <div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#77736c]">Code Lines</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {(metrics.code_lines || 0).toLocaleString()}
              </div>
              <div className="mt-0.5 text-[10px] text-[#77736c]">
                Total: {(metrics.total_lines || 0).toLocaleString()} lines
              </div>
            </div>

            <div className="card p-4">
              <div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#77736c]">Primary Stack</div>
              <div className="mt-2 text-lg font-semibold text-white truncate">
                {languages[0] ? languages[0][0] : 'Polyglot'}
              </div>
              <div className="mt-0.5 text-[10px] text-[#77736c] truncate">
                {languages.map(([l]) => l).join(', ') || 'Various'}
              </div>
            </div>

            <div className="card p-4">
              <div className="font-mono text-[9px] uppercase tracking-[.15em] text-[#77736c]">CodeVitals Score</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {interview?.score != null ? (
                  <>
                    {interview.score}
                    <span className="text-sm text-[#77736c]">/100</span>
                  </>
                ) : (
                  <span className="text-base text-[#77736c]">Not taken</span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-[#77736c]">
                {interview?.status === 'completed' ? 'Assessment finalized' : 'Interactive defense'}
              </div>
            </div>
          </div>
        </div>

        {/* 2. ANATOMY ASSESSMENT */}
        <section className="card mt-8 p-5 sm:p-7 reveal">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-[9px] uppercase tracking-[.16em]">
            <Layers size={14} />
            <span>01 / Codebase Anatomy Assessment</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">System Architecture & Subsystems</h2>
          <p className="mt-3 text-sm leading-6 text-[#aaa69e]">{explanation}</p>

          {components.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-[#77736c]">Detected Components:</span>
              {components.map((c: any) => (
                <span
                  key={c.id || c.name}
                  className="rounded border border-white/[.08] bg-white/[.03] px-2.5 py-1 font-mono text-[11px] text-[#c8c4bc]"
                >
                  {c.name} ({c.file_count} files)
                </span>
              ))}
            </div>
          )}

          {/* Strengths & Concerns */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.03] p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <CheckCircle2 size={13} />
                <span>Architectural Strengths</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[#c8c4bc]">
                {(briefing.architectural_strengths || briefing.strengths || []).map((x: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400 shrink-0">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[.03] p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <AlertTriangle size={13} />
                <span>Architectural Concerns</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[#c8c4bc]">
                {(briefing.architectural_concerns || briefing.priorities || []).map((x: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-400 shrink-0">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 3. DIAGNOSTICS SUMMARY */}
        <section className="card mt-8 p-5 sm:p-7 reveal">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-[9px] uppercase tracking-[.16em]">
            <ShieldAlert size={14} />
            <span>02 / Diagnostics Summary</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">Code Defects & Security Analysis</h2>
          <p className="mt-1 text-sm text-[#aaa69e]">
            {counts.distinct.totalHighPriority} distinct issues identified across {counts.occurrences.totalHighPriority} occurrences in the analyzed codebase.
          </p>

          {/* Breakdown cards */}
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded border border-rose-500/20 bg-rose-500/[.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-rose-400">Critical</span>
                <Flame size={14} className="text-rose-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">{counts.distinct.critical}</div>
              <div className="text-[10px] text-[#77736c]">{counts.occurrences.critical} occurrence(s)</div>
            </div>

            <div className="rounded border border-amber-500/20 bg-amber-500/[.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-amber-400">High</span>
                <AlertTriangle size={14} className="text-amber-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">{counts.distinct.high}</div>
              <div className="text-[10px] text-[#77736c]">{counts.occurrences.high} occurrence(s)</div>
            </div>

            <div className="rounded border border-yellow-500/20 bg-yellow-500/[.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-yellow-300">Medium</span>
                <Bug size={14} className="text-yellow-300" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">{counts.distinct.medium}</div>
              <div className="text-[10px] text-[#77736c]">{counts.occurrences.medium} occurrence(s)</div>
            </div>

            <div className="rounded border border-slate-500/20 bg-slate-500/[.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-slate-400">Low / Debt</span>
                <Info size={14} className="text-slate-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-white">{counts.distinct.low}</div>
              <div className="text-[10px] text-[#77736c]">{counts.occurrences.low} occurrence(s)</div>
            </div>
          </div>
        </section>

        {/* 4. GROUPED DIAGNOSTIC FINDINGS */}
        <section className="mt-8 reveal">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-[9px] uppercase tracking-[.16em]">
              <ShieldAlert size={14} />
              <span>03 / Grouped Diagnostic Findings ({groupedIssues.length})</span>
            </div>
          </div>

          {groupedIssues.length === 0 ? (
            <div className="card p-6 text-center text-sm text-[#77736c]">
              No diagnostic defects detected in the analyzed source code.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedIssues.map((issue, idx) => {
                const s = issue.severity.toLowerCase()
                const badgeColor =
                  s === 'critical'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                    : s === 'high'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : s === 'medium'
                    ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                    : 'border-slate-500/30 bg-slate-500/10 text-slate-300'

                return (
                  <div key={issue.id || idx} className="card p-5 sm:p-6 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-base font-semibold text-white">{issue.title}</h3>
                        <span className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${badgeColor}`}>
                          {issue.severity}
                        </span>
                        <span className="rounded border border-white/[.08] bg-white/[.03] px-2 py-0.5 font-mono text-[9px] uppercase text-[#8a867f]">
                          {issue.category}
                        </span>
                      </div>

                      <span className="rounded border border-amber-400/20 bg-amber-400/[.05] px-2.5 py-0.5 font-mono text-[10px] text-amber-300">
                        {issue.occurrenceCount} location{issue.occurrenceCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">Why It Matters</div>
                      <p className="mt-1 text-xs leading-5 text-[#c8c4bc]">{issue.why_it_matters}</p>
                    </div>

                    {issue.suggested_fix && (
                      <div className="rounded border border-white/[.06] bg-white/[.015] p-3 text-xs leading-5 text-[#aaa69e]">
                        <span className="font-semibold text-white">Suggested Remediation: </span>
                        {issue.suggested_fix}
                      </div>
                    )}

                    {/* Occurrence locations */}
                    <div className="space-y-1.5 pt-1">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                        Affected Source Locations ({issue.occurrences.length}):
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {issue.occurrences.map((occ, oIdx) => (
                          <div
                            key={occ.id || oIdx}
                            className="rounded border border-white/[.05] bg-black/20 px-3 py-2 text-xs font-mono"
                          >
                            <div className="text-amber-300/90 truncate">
                              {occ.file_path || 'Repository root'}
                              {occ.line ? `:${occ.line}` : ''}
                            </div>
                            {occ.evidence && (
                              <div className="mt-1 truncate text-[11px] text-[#77736c] opacity-80">
                                {occ.evidence}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 5. RECOMMENDED IMPROVEMENTS */}
        {recommendations.length > 0 && (
          <section className="mt-8 reveal">
            <div className="mb-4 flex items-center gap-2 text-amber-400 font-mono text-[9px] uppercase tracking-[.16em]">
              <Wrench size={14} />
              <span>04 / Recommended Improvements ({recommendations.length})</span>
            </div>

            <div className="space-y-3.5">
              {recommendations.map((rec: any, idx: number) => (
                <div key={rec.id || idx} className="card p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-sm font-semibold text-white">{rec.title}</h3>
                    </div>
                    <span className="rounded border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[9px] uppercase font-bold text-amber-300">
                      {rec.priority_tier || rec.priority || 'Action'}
                    </span>
                  </div>

                  <p className="text-xs leading-5 text-[#aaa69e]">
                    {rec.why_it_matters || rec.explanation}
                  </p>

                  {(rec.recommended_approach || rec.solution) && (
                    <div className="rounded border border-white/[.06] bg-white/[.015] p-3 text-xs text-[#c8c4bc]">
                      <span className="font-semibold text-white">Recommended Approach: </span>
                      {rec.recommended_approach || rec.solution}
                    </div>
                  )}

                  {rec.evidence && (
                    <div className="font-mono text-[11px] text-[#77736c]">
                      <span className="text-[#55514b]">Evidence: </span>
                      {rec.evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. ANALYSIS LIMITATIONS & EVIDENCE SCOPE */}
        <section className="mt-8 border border-white/[.08] rounded-xl bg-white/[.015] p-5 sm:p-6 reveal">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-amber-400/90 font-bold">
            <Info size={14} />
            <span>05 / Evidence & Analysis Limitations</span>
          </div>
          <p className="mt-2 text-xs text-[#aaa69e]">
            RepoAutopsy static analysis evaluates syntactic AST patterns and import graphs. Conclusions represent deterministic source evidence:
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-[#8a867f]">
            {(briefing.analysis_limitations || [
              'Static code analysis evaluates syntactic patterns; runtime behaviors and external environment variables cannot be fully established.',
              'Dynamic import calls (e.g. importlib or runtime variables) are not resolved in the static dependency graph.',
              'File classifications prioritize first-party application source code, excluding vendor dependencies and generated lockfiles.'
            ]).map((lim: string, lIdx: number) => (
              <li key={lIdx} className="flex gap-2">
                <span className="text-amber-400/60">•</span>
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 6. CODEVITALS RESULTS */}
        <section className="card mt-8 p-5 sm:p-7 reveal">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-[9px] uppercase tracking-[.16em]">
            <BrainCircuit size={14} />
            <span>06 / CodeVitals Assessment</span>
          </div>

          {interview ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Candidate Defense Evaluation</h3>
                  <p className="text-xs text-[#77736c]">Status: {interview.status}</p>
                </div>
                <div className="rounded-lg border border-white/[.1] bg-white/[.02] px-4 py-2 text-right">
                  <div className="font-mono text-[9px] uppercase text-[#77736c]">Overall Score</div>
                  <div className="text-2xl font-bold text-white">
                    {interview.score ?? 0}
                    <span className="text-sm text-[#77736c]">/100</span>
                  </div>
                </div>
              </div>

              {interview.feedback?.summary && (
                <p className="text-xs leading-5 text-[#aaa69e]">{interview.feedback.summary}</p>
              )}

              {interview.turns && interview.turns.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                    Question Assessment Turns:
                  </div>
                  {interview.turns.map((t: any, i: number) => (
                    <div key={t.id || i} className="rounded border border-white/[.06] bg-black/20 p-3 text-xs space-y-1.5">
                      <div className="font-medium text-white">
                        <span className="font-mono text-amber-400 mr-2">Q{i + 1}:</span>
                        {t.question}
                      </div>
                      {t.answer && (
                        <div className="text-[#8a867f]">
                          <span className="font-semibold text-[#aaa69e]">Answer: </span>
                          {t.answer}
                        </div>
                      )}
                      {t.evaluation && (
                        <div className="flex items-center gap-3 pt-1 text-[11px]">
                          <span className="font-mono text-emerald-400 font-semibold">
                            Score: {t.evaluation.score}/100
                          </span>
                          <span className="text-[#77736c]">Verdict: {t.evaluation.verdict}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded border border-white/[.06] bg-white/[.02] p-5 text-center">
              <p className="text-xs text-[#8a867f]">
                No CodeVitals assessment has been completed yet for this repository.
              </p>
              <Link
                href={`/repositories/${params.id}/codevitals`}
                className="mt-3 inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400/10 px-4 py-2 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition"
              >
                <span>Start CodeVitals Assessment</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
