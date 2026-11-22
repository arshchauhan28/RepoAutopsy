'use client'

import { useState } from 'react'
import {
  FileText,
  Copy,
  Check,
  Printer,
  ShieldAlert,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react'
import type { PullRequestAnalysis } from '@/lib/api'

interface PRCaseReportProps {
  pr: PullRequestAnalysis
}

export function PRCaseReport({ pr }: PRCaseReportProps) {
  const [copied, setCopied] = useState(false)

  const summary: any = pr.summary || {}
  const diagDelta = pr.diagnostics_delta || {
    new_findings: [],
    resolved_findings: [],
    unchanged_findings: [],
    new_high_severity_count: 0,
    resolved_count: 0,
  }

  const newFindings = diagDelta.new_findings || []
  const resolvedFindings = diagDelta.resolved_findings || []
  const impacts = pr.change_impacts || []
  const testRecs = pr.test_recommendations || []

  const generateMarkdown = () => {
    const mdLines = [
      `# PULL REQUEST AUTOPSY REPORT: #${pr.pr_number} — ${pr.pr_title}`,
      `**Repository:** \`${pr.repo_owner}/${pr.repo_name}\` | **Author:** \`${pr.pr_author || 'Unknown'}\``,
      `**Branch:** \`${pr.head_branch}\` → \`${pr.base_branch}\` | **Commits:** \`${pr.base_sha?.slice(0, 8)}\` → \`${pr.head_sha?.slice(0, 8)}\``,
      `**Review Priority:** **${pr.review_priority.toUpperCase()}**`,
      '',
      '## 1. Executive Summary',
      summary.executive_summary || 'Pull request analysis completed.',
      '',
      '### Review Priority Reasons:',
      ...(pr.review_priority_reasons || []).map((r) => `- ${r}`),
      '',
      '## 2. Change Overview',
      `- **Files Changed:** ${pr.changed_files_count}`,
      `- **Additions:** +${pr.additions} lines`,
      `- **Deletions:** -${pr.deletions} lines`,
      '',
      '## 3. Change Impact Analysis',
      ...impacts.map(
        (imp) =>
          `- **${imp.affected_component_name}** (\`${imp.impact_type}\` / ${imp.confidence} confidence): ${imp.explanation}`
      ),
      '',
      '## 4. Diagnostics Delta (Regressions & Fixes)',
      `- **New Issues Introduced:** ${newFindings.length}`,
      `- **Issues Resolved:** ${resolvedFindings.length}`,
    ]

    if (newFindings.length > 0) {
      mdLines.push('\n### Newly Introduced Regressions:')
      for (const nf of newFindings) {
        mdLines.push(`- \`[${nf.severity.toUpperCase()}]\` **${nf.title}** in \`${nf.file_path}\`: ${nf.description}`)
      }
    }

    if (resolvedFindings.length > 0) {
      mdLines.push('\n### Resolved Diagnostic Issues:')
      for (const rf of resolvedFindings) {
        mdLines.push(`- \`[${rf.severity.toUpperCase()}]\` **${rf.title}** in \`${rf.file_path}\``)
      }
    }

    mdLines.push('', '## 5. Recommended Test Strategy')
    for (const tr of testRecs) {
      mdLines.push(`- **${tr.category.toUpperCase()}**: ${tr.rationale} (Suggested: \`${tr.recommended_test_files?.join(', ')}\`)`)
    }

    mdLines.push('', '## 6. Analysis Limitations')
    for (const lim of pr.limitations || []) {
      mdLines.push(`- ${lim}`)
    }

    return mdLines.join('\n')
  }

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generateMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Change-Focused Case Report</h2>
          <p className="text-xs text-[#77736c]">Technical summary of pull request changes, risk factors, and verification strategy</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-xs font-medium text-[#aaa69e] hover:bg-white/[.06] hover:text-white transition"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[.12] bg-white/[.03] px-3 py-1.5 text-xs font-medium text-[#aaa69e] hover:bg-white/[.06] hover:text-white transition"
          >
            <Printer size={13} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Surface */}
      <div className="card p-6 space-y-6 printable-area bg-[#0c0f13]">
        {/* Header Block */}
        <div className="border-b border-white/[.08] pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs font-bold text-amber-400">
              PR #{pr.pr_number} CASE REPORT
            </span>
            <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
              pr.review_priority === 'high'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : pr.review_priority === 'medium'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {pr.review_priority} Priority Review
            </span>
          </div>

          <h1 className="mt-2 text-lg font-bold text-white">{pr.pr_title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-[#77736c]">
            <span>Repo: {pr.repo_owner}/{pr.repo_name}</span>
            <span>·</span>
            <span>Branch: {pr.head_branch} → {pr.base_branch}</span>
            <span>·</span>
            <span>Author: {pr.pr_author || 'Unknown'}</span>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
            01 / Executive Summary
          </h3>
          <p className="text-sm leading-6 text-[#c8c4bc]">
            {summary.executive_summary || 'Pull request analysis completed.'}
          </p>

          {pr.review_priority_reasons && pr.review_priority_reasons.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/[.08] bg-white/[.02] p-3 space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#77736c] block">
                Review Priority Signals:
              </span>
              {pr.review_priority_reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#c8c4bc]">
                  <Flame size={12} className="text-amber-400 shrink-0" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Change Overview */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
            02 / Change Overview
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
              <div className="font-mono text-lg font-bold text-white">{pr.changed_files_count}</div>
              <div className="font-mono text-[10px] text-[#77736c]">Files Changed</div>
            </div>
            <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
              <div className="font-mono text-lg font-bold text-emerald-400">+{pr.additions}</div>
              <div className="font-mono text-[10px] text-[#77736c]">Additions</div>
            </div>
            <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-center">
              <div className="font-mono text-lg font-bold text-rose-400">-{pr.deletions}</div>
              <div className="font-mono text-[10px] text-[#77736c]">Deletions</div>
            </div>
          </div>
        </div>

        {/* 3. Change Impact */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
            03 / Subsystem Impact Analysis
          </h3>
          <div className="space-y-2">
            {impacts.map((imp, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs text-white">{imp.affected_component_name}</span>
                  <span className="font-mono text-[10px] uppercase text-amber-400/90">{imp.impact_type}</span>
                </div>
                <p className="text-xs text-[#aaa69e]">{imp.explanation}</p>
                <div className="font-mono text-[10px] text-[#77736c] pt-1">
                  Evidence: {imp.dependency_evidence}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Diagnostics Delta */}
        <div className="space-y-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
            04 / Diagnostics Delta
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* New Regressions */}
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/[.03] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                <ShieldAlert size={14} />
                <span>Newly Introduced Regressions ({newFindings.length})</span>
              </div>
              {newFindings.length > 0 ? (
                <div className="space-y-2">
                  {newFindings.map((nf, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="font-medium text-white">{nf.title}</div>
                      <div className="font-mono text-[10px] text-[#77736c]">{nf.file_path}</div>
                      <div className="text-[#aaa69e] text-[11px]">{nf.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#77736c]">No new high-severity findings introduced by this PR.</div>
              )}
            </div>

            {/* Resolved Findings */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[.03] p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                <CheckCircle2 size={14} />
                <span>Resolved Diagnostics ({resolvedFindings.length})</span>
              </div>
              {resolvedFindings.length > 0 ? (
                <div className="space-y-2">
                  {resolvedFindings.map((rf, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="font-medium text-white">{rf.title}</div>
                      <div className="font-mono text-[10px] text-[#77736c]">{rf.file_path}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#77736c]">No previous codebase diagnostics were resolved.</div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Test Recommendations */}
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
            05 / Recommended Verification & Test Strategy
          </h3>
          <div className="space-y-2">
            {testRecs.map((tr, idx) => (
              <div key={idx} className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white uppercase tracking-wider font-mono text-[10px] text-amber-400">
                    {tr.category} Testing
                  </span>
                  <span className="font-mono text-[10px] text-[#77736c]">{tr.target_module}</span>
                </div>
                <p className="text-[#c8c4bc]">{tr.rationale}</p>
                {tr.recommended_test_files && tr.recommended_test_files.length > 0 && (
                  <div className="mt-1.5 font-mono text-[10px] text-[#77736c]">
                    Suggested targets: {tr.recommended_test_files.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 6. Limitations */}
        <div className="border-t border-white/[.08] pt-4 text-[11px] text-[#77736c] space-y-1">
          <div className="font-mono text-[10px] uppercase text-[#aaa69e]">Analysis Limitations</div>
          {pr.limitations?.map((l, i) => (
            <div key={i}>• {l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
