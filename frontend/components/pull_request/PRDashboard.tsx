'use client'

import { useState } from 'react'
import {
  GitPullRequest,
  ArrowLeft,
  Flame,
  FileCode,
  Layers,
  ShieldAlert,
  Sparkles,
  GitCommit,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  TestTube,
} from 'lucide-react'
import type { PullRequestAnalysis } from '@/lib/api'
import { PRDiffViewer } from './PRDiffViewer'
import { PRCaseReport } from './PRCaseReport'

interface PRDashboardProps {
  pr: PullRequestAnalysis
  onBackToRepo: () => void
}

type PRTab = 'diff' | 'impact' | 'architecture' | 'diagnostics' | 'case-report'

export function PRDashboard({ pr, onBackToRepo }: PRDashboardProps) {
  const [activeTab, setActiveTab] = useState<PRTab>('diff')
  const [showReasons, setShowReasons] = useState(false)

  const summary = pr.summary || {}
  const diagDelta = pr.diagnostics_delta || {
    new_findings: [],
    resolved_findings: [],
    unchanged_findings: [],
    new_high_severity_count: 0,
    resolved_count: 0,
  }
  const archDelta = pr.architecture_delta || {
    added_modules: [],
    removed_modules: [],
    new_dependencies: [],
    new_circular_cycles: [],
    resolved_circular_cycles: [],
    changed_service_boundaries: [],
  }

  const newFindings = diagDelta.new_findings || []
  const resolvedFindings = diagDelta.resolved_findings || []
  const impacts = pr.change_impacts || []

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-rose-500/40 bg-rose-500/10 text-rose-300'
      case 'medium':
        return 'border-amber-400/40 bg-amber-400/10 text-amber-300'
      default:
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    }
  }

  return (
    <div className="space-y-6 reveal">
      {/* Top Header Card */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBackToRepo}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#aaa69e] hover:text-white transition"
          >
            <ArrowLeft size={14} />
            <span>Back to Repository Snapshot</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowReasons(!showReasons)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition ${getPriorityStyle(
                pr.review_priority
              )}`}
            >
              <Flame size={12} />
              <span>{pr.review_priority} Priority Review</span>
            </button>

            {/* Priority Reasons Dropdown */}
            {showReasons && pr.review_priority_reasons && pr.review_priority_reasons.length > 0 && (
              <div className="absolute right-0 top-full mt-2 z-40 w-80 rounded-xl border border-white/[.15] bg-[#0c0f13] p-3.5 shadow-2xl space-y-2">
                <div className="font-mono text-[10px] uppercase text-[#77736c] font-bold">
                  Why {pr.review_priority.toUpperCase()} priority?
                </div>
                <div className="space-y-1.5 text-xs text-[#c8c4bc]">
                  {pr.review_priority_reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PR Identity */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-amber-400">
                PR #{pr.pr_number}
              </span>
              <span className="text-sm font-semibold text-white truncate max-w-md">{pr.pr_title}</span>
            </div>
            <span className="rounded border border-white/[.1] bg-white/[.03] px-2.5 py-0.5 font-mono text-[10px] text-[#9ca3af]">
              Scope: {pr.analysis_coverage || pr.summary?.analysis_coverage || 'Changed-File with Dependency Graph Analysis'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs text-[#77736c]">
            <span className="text-[#aaa69e]">@{pr.pr_author || 'author'}</span>
            <span>·</span>
            <div className="flex items-center gap-1.5 rounded bg-white/[.04] px-2 py-0.5">
              <span>{pr.head_branch}</span>
              <span className="text-amber-400">→</span>
              <span>{pr.base_branch}</span>
            </div>
            <span>·</span>
            <span title={`Base: ${pr.base_sha}`}>base: {pr.base_sha?.slice(0, 7)}</span>
            <span>→</span>
            <span title={`Head: ${pr.head_sha}`}>head: {pr.head_sha?.slice(0, 7)}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 pt-2">
          <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
            <div className="font-mono text-base font-bold text-white">{pr.changed_files_count}</div>
            <div className="font-mono text-[10px] text-[#77736c]">Files Changed</div>
          </div>
          <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
            <div className="font-mono text-base font-bold text-emerald-400">+{pr.additions}</div>
            <div className="font-mono text-[10px] text-[#77736c]">Lines Added</div>
          </div>
          <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
            <div className="font-mono text-base font-bold text-rose-400">-{pr.deletions}</div>
            <div className="font-mono text-[10px] text-[#77736c]">Lines Removed</div>
          </div>
          <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
            <div className="font-mono text-base font-bold text-amber-400">{impacts.length}</div>
            <div className="font-mono text-[10px] text-[#77736c]">Impact Points</div>
          </div>
          <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center col-span-2 sm:col-span-1">
            <div className={`font-mono text-base font-bold ${newFindings.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {newFindings.length}
            </div>
            <div className="font-mono text-[10px] text-[#77736c]">New Regressions</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[.12] bg-[#0c0f13]/90 p-1.5 shadow-lg backdrop-blur-md">
        <button
          onClick={() => setActiveTab('diff')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'diff'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
          }`}
        >
          <FileCode size={13} />
          <span>Changes & Diffs ({pr.changed_files_count})</span>
        </button>

        <button
          onClick={() => setActiveTab('impact')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'impact'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
          }`}
        >
          <Layers size={13} />
          <span>Impact Analysis ({impacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'architecture'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
          }`}
        >
          <GitCommit size={13} />
          <span>Architecture Delta</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'diagnostics'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
          }`}
        >
          <ShieldAlert size={13} />
          <span>Diagnostics Delta</span>
          {newFindings.length > 0 && (
            <span className="rounded bg-rose-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-rose-300">
              {newFindings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('case-report')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === 'case-report'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-[#aaa69e] hover:bg-white/[.04] hover:text-white'
          }`}
        >
          <Sparkles size={13} />
          <span>Case Report</span>
        </button>
      </div>

      {/* Tab 1: Diff Viewer */}
      {activeTab === 'diff' && <PRDiffViewer files={pr.changed_files} />}

      {/* Tab 2: Change Impact */}
      {activeTab === 'impact' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white">Direct & Downstream Dependency Impact</h3>
            <span className="font-mono text-xs text-[#77736c]">{impacts.length} component impact points</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {impacts.map((imp, idx) => (
              <div key={idx} className="card p-4 space-y-2 border-white/[.1]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-amber-400" />
                    <span className="font-medium text-xs text-white">{imp.affected_component_name}</span>
                  </div>
                  <span className={`font-mono text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                    imp.impact_type === 'contract_risk'
                      ? 'bg-rose-500/20 text-rose-300'
                      : imp.impact_type === 'downstream_consumer'
                      ? 'bg-amber-400/20 text-amber-300'
                      : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {imp.impact_type.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs leading-5 text-[#c8c4bc]">{imp.explanation}</p>

                <div className="rounded border border-white/[.06] bg-black/40 p-2 font-mono text-[10px] text-[#77736c]">
                  Evidence: {imp.dependency_evidence}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Architecture Delta */}
      {activeTab === 'architecture' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Added Modules */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 size={14} />
              <span>Added Modules ({archDelta.added_modules.length})</span>
            </div>
            {archDelta.added_modules.length > 0 ? (
              <div className="space-y-1.5 font-mono text-xs text-[#c8c4bc]">
                {archDelta.added_modules.map((m, i) => (
                  <div key={i} className="rounded bg-white/[.02] p-2 border border-white/[.05]">
                    {m}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#77736c]">No new modules introduced.</div>
            )}
          </div>

          {/* Removed Modules */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <AlertTriangle size={14} />
              <span>Removed Modules ({archDelta.removed_modules.length})</span>
            </div>
            {archDelta.removed_modules.length > 0 ? (
              <div className="space-y-1.5 font-mono text-xs text-[#c8c4bc]">
                {archDelta.removed_modules.map((m, i) => (
                  <div key={i} className="rounded bg-white/[.02] p-2 border border-white/[.05]">
                    {m}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#77736c]">No modules deleted.</div>
            )}
          </div>

          {/* Changed Service Boundaries */}
          <div className="card p-4 space-y-3 sm:col-span-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <Layers size={14} />
              <span>Changed Subsystems & Boundaries</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {archDelta.changed_service_boundaries.map((b, i) => (
                <span
                  key={i}
                  className="rounded-lg border border-white/[.08] bg-white/[.03] px-3 py-1 font-mono text-xs text-[#c8c4bc]"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Diagnostics Delta */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Newly Introduced Regressions */}
            <div className="card p-4 space-y-3 border-rose-500/20 bg-rose-500/[.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                  <ShieldAlert size={15} />
                  <span>Newly Introduced Regressions ({newFindings.length})</span>
                </div>
                {newFindings.length > 0 && (
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-rose-300">
                    ACTION REQUIRED
                  </span>
                )}
              </div>

              {newFindings.length > 0 ? (
                <div className="space-y-2.5">
                  {newFindings.map((nf, i) => (
                    <div key={i} className="rounded-lg border border-rose-500/30 bg-black/40 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{nf.title}</span>
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                          {nf.severity}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-rose-400/80">{nf.file_path}</div>
                      <p className="text-xs text-[#aaa69e] leading-5">{nf.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-emerald-400">
                  Zero new regressions detected in this pull request!
                </div>
              )}
            </div>

            {/* Resolved Base Findings */}
            <div className="card p-4 space-y-3 border-emerald-500/20 bg-emerald-500/[.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                  <CheckCircle2 size={15} />
                  <span>Resolved Issues ({resolvedFindings.length})</span>
                </div>
                {resolvedFindings.length > 0 && (
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
                    FIXES DETECTED
                  </span>
                )}
              </div>

              {resolvedFindings.length > 0 ? (
                <div className="space-y-2.5">
                  {resolvedFindings.map((rf, i) => (
                    <div key={i} className="rounded-lg border border-emerald-500/30 bg-black/40 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{rf.title}</span>
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                          {rf.category}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-[#77736c]">{rf.file_path}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[#77736c]">
                  No prior codebase diagnostics resolved in this PR.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Case Report */}
      {activeTab === 'case-report' && <PRCaseReport pr={pr} />}
    </div>
  )
}
