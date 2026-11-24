'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Flame,
  Bug,
  ShieldCheck,
  Wrench,
  Sparkles,
  ArrowRight,
  Layers,
  Link as LinkIcon,
} from 'lucide-react'
import type { Finding, Recommendation } from '@/lib/api'
import { groupFindings, type GroupedIssue, type DiagnosticCounts } from '@/lib/grouping'

interface CodebaseDoctorProps {
  findings: Finding[]
  recommendations?: Recommendation[]
  owner?: string
  repo?: string
  defaultBranch?: string | null
  initialTab?: 'issues' | 'recommendations'
  initialCategory?: string
  onSelectIssue?: (findingId: string) => void
}

export function FindingList({
  findings,
  recommendations = [],
  owner,
  repo,
  defaultBranch = 'main',
  initialTab = 'issues',
  initialCategory = 'all',
  onSelectIssue,
}: CodebaseDoctorProps) {
  const [activeTab, setActiveTab] = useState<'issues' | 'recommendations'>(initialTab)
  const [severityFilter, setSeverityFilter] = useState<string>('high_priority') // default: Critical + High + Medium
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || 'all')
  const [showLow, setShowLow] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedIssueIds, setExpandedIssueIds] = useState<Record<string, boolean>>({})
  const [recFilter, setRecFilter] = useState<'all' | 'fix_now' | 'improve_later'>('all')
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null)

  // Sync category filter when initialCategory prop changes
  useEffect(() => {
    if (initialCategory && initialCategory !== 'all') {
      setCategoryFilter(initialCategory)
      setActiveTab('issues')
    }
  }, [initialCategory])

  // Group findings using robust deduplication
  const { groupedIssues, counts } = useMemo(() => {
    return groupFindings(findings)
  }, [findings])

  // Filter grouped issues
  const filteredIssues = useMemo(() => {
    return groupedIssues.filter(g => {
      const s = g.severity.toLowerCase()
      const c = g.category.toLowerCase()

      // Severity filtering
      if (severityFilter === 'high_priority') {
        if (!showLow && s === 'low') return false
        if (showLow && s === 'low') {
          // allowed
        } else if (s !== 'critical' && s !== 'high' && s !== 'medium') {
          return false
        }
      } else if (severityFilter !== 'all') {
        if (s !== severityFilter) return false
      } else if (!showLow && s === 'low') {
        return false
      }

      // Category filtering
      if (categoryFilter !== 'all' && c !== categoryFilter) {
        return false
      }

      // Search filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = g.title.toLowerCase().includes(q)
        const matchFile = (g.file_path || '').toLowerCase().includes(q)
        const matchWhy = g.why_it_matters.toLowerCase().includes(q)
        const matchFix = g.suggested_fix.toLowerCase().includes(q)
        const matchOccurrences = g.occurrences.some(
          occ =>
            (occ.evidence || '').toLowerCase().includes(q) ||
            (occ.description || '').toLowerCase().includes(q)
        )
        if (!matchTitle && !matchFile && !matchWhy && !matchFix && !matchOccurrences) {
          return false
        }
      }

      return true
    })
  }, [groupedIssues, severityFilter, categoryFilter, showLow, searchQuery])

  // Filter recommendations
  const filteredRecs = useMemo(() => {
    return recommendations.filter(r => {
      const p = (r.priority || '').toLowerCase()
      if (recFilter === 'fix_now' && !p.includes('fix') && !p.includes('now') && !p.includes('critical')) return false
      if (recFilter === 'improve_later' && (p.includes('fix') || p.includes('now') || p.includes('critical'))) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          r.title.toLowerCase().includes(q) ||
          (r.why_it_matters || r.explanation || '').toLowerCase().includes(q) ||
          (r.recommended_approach || r.solution || '').toLowerCase().includes(q) ||
          (r.evidence || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [recommendations, recFilter, searchQuery])

  // Split recommendations into Fix Now vs Improve Later
  const fixNowRecs = useMemo(() => {
    return filteredRecs.filter(r => {
      const p = (r.priority || '').toLowerCase()
      return p.includes('fix') || p.includes('now') || p.includes('critical') || p.includes('high')
    })
  }, [filteredRecs])

  const improveLaterRecs = useMemo(() => {
    return filteredRecs.filter(r => {
      const p = (r.priority || '').toLowerCase()
      return !p.includes('fix') && !p.includes('now') && !p.includes('critical') && !p.includes('high')
    })
  }, [filteredRecs])

  const toggleExpand = (id: string) => {
    setExpandedIssueIds(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const makeGithubLink = (filePath?: string | null, line?: number | null) => {
    if (!filePath || !owner || !repo) return null
    const branch = defaultBranch || 'main'
    return `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}${line ? `#L${line}` : ''}`
  }

  const navigateToRelatedIssues = (relatedIds?: string[]) => {
    setActiveTab('issues')
    setSeverityFilter('all')
    if (relatedIds && relatedIds.length > 0) {
      setHighlightedIssueId(relatedIds[0])
      // Auto expand the matching group
      const matchingGroup = groupedIssues.find(g =>
        g.occurrences.some(occ => relatedIds.includes(occ.id))
      )
      if (matchingGroup) {
        setExpandedIssueIds(prev => ({ ...prev, [matchingGroup.id]: true }))
      }
    }
  }

  const getSeverityBadge = (sev: string) => {
    const s = sev.toLowerCase()
    if (s === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-400">
          <Flame size={10} /> Critical
        </span>
      )
    }
    if (s === 'high') {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400">
          <AlertTriangle size={10} /> High
        </span>
      )
    }
    if (s === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-yellow-300">
          <Bug size={10} /> Medium
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-slate-400">
        <Info size={10} /> Low
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* 5.1 DIAGNOSTIC SUMMARY BAR */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          onClick={() => {
            setActiveTab('issues')
            setSeverityFilter('critical')
          }}
          className={`flex items-center justify-between rounded-lg border p-3.5 text-left transition ${
            activeTab === 'issues' && severityFilter === 'critical'
              ? 'border-rose-400/60 bg-rose-500/10 ring-1 ring-rose-400/30'
              : 'border-white/[.08] bg-white/[.02] hover:bg-white/[.04]'
          }`}
        >
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-rose-400">Critical</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{counts.distinct.critical}</span>
              <span className="text-[10px] text-[#77736c]">({counts.occurrences.critical} occ.)</span>
            </div>
          </div>
          <Flame size={20} className="text-rose-400/80" />
        </button>

        <button
          onClick={() => {
            setActiveTab('issues')
            setSeverityFilter('high')
          }}
          className={`flex items-center justify-between rounded-lg border p-3.5 text-left transition ${
            activeTab === 'issues' && severityFilter === 'high'
              ? 'border-amber-400/60 bg-amber-500/10 ring-1 ring-amber-400/30'
              : 'border-white/[.08] bg-white/[.02] hover:bg-white/[.04]'
          }`}
        >
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-amber-400">High</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{counts.distinct.high}</span>
              <span className="text-[10px] text-[#77736c]">({counts.occurrences.high} occ.)</span>
            </div>
          </div>
          <AlertTriangle size={20} className="text-amber-400/80" />
        </button>

        <button
          onClick={() => {
            setActiveTab('issues')
            setSeverityFilter('medium')
          }}
          className={`flex items-center justify-between rounded-lg border p-3.5 text-left transition ${
            activeTab === 'issues' && severityFilter === 'medium'
              ? 'border-yellow-400/60 bg-yellow-500/10 ring-1 ring-yellow-400/30'
              : 'border-white/[.08] bg-white/[.02] hover:bg-white/[.04]'
          }`}
        >
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-yellow-300">Medium</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{counts.distinct.medium}</span>
              <span className="text-[10px] text-[#77736c]">({counts.occurrences.medium} occ.)</span>
            </div>
          </div>
          <Bug size={20} className="text-yellow-300/80" />
        </button>

        <button
          onClick={() => {
            setActiveTab('issues')
            setShowLow(!showLow)
            if (!showLow) setSeverityFilter('all')
          }}
          className={`flex items-center justify-between rounded-lg border p-3.5 text-left transition ${
            showLow
              ? 'border-slate-400/60 bg-slate-500/10 ring-1 ring-slate-400/30'
              : 'border-white/[.08] bg-white/[.02] hover:bg-white/[.04]'
          }`}
        >
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Low (Technical Debt)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-[#8a867f]">{counts.distinct.low}</span>
              <span className="text-[10px] text-[#55514b]">({counts.occurrences.low} occ.)</span>
            </div>
          </div>
          <Info size={20} className="text-slate-400/80" />
        </button>
      </div>

      {/* DIAGNOSTICS PRIMARY TABS: Detected Issues vs Recommended Improvements */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[.08] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('issues')}
            className={`flex items-center gap-2 rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition shrink-0 min-h-[40px] ${
              activeTab === 'issues'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'text-[#aaa69e] hover:bg-white/[.05] hover:text-white'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Detected Issues</span>
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                activeTab === 'issues' ? 'bg-black/20 text-black' : 'bg-white/[.08] text-[#aaa69e]'
              }`}
            >
              {counts.distinct.totalHighPriority}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-2 rounded-lg px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition shrink-0 min-h-[40px] ${
              activeTab === 'recommendations'
                ? 'bg-amber-400 text-black shadow-sm'
                : 'text-[#aaa69e] hover:bg-white/[.05] hover:text-white'
            }`}
          >
            <Wrench size={16} />
            <span>Recommendations</span>
            {recommendations.length > 0 && (
              <span
                className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                  activeTab === 'recommendations' ? 'bg-black/20 text-black' : 'bg-white/[.08] text-[#aaa69e]'
                }`}
              >
                {recommendations.length}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-auto sm:min-w-[240px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#77736c]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'issues' ? 'Search issues, files, risks...' : 'Search recommended fixes...'
            }
            className="w-full rounded border border-white/[.1] bg-black/30 py-2 pl-8 pr-3 text-xs text-white placeholder:text-[#55514b] focus:border-amber-400 focus:outline-none min-h-[40px]"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: DETECTED ISSUES */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {/* Sub-filters for Issues */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-white/[.06] bg-white/[.015] p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 font-mono text-[10px] uppercase text-[#77736c]">Severity:</span>
              <button
                onClick={() => setSeverityFilter('high_priority')}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  severityFilter === 'high_priority'
                    ? 'bg-amber-400 font-semibold text-black'
                    : 'text-[#aaa69e] hover:bg-white/[.05]'
                }`}
              >
                All High Priority ({counts.distinct.totalHighPriority})
              </button>
              <button
                onClick={() => setSeverityFilter('critical')}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  severityFilter === 'critical'
                    ? 'bg-rose-500 font-semibold text-white'
                    : 'text-[#aaa69e] hover:bg-white/[.05]'
                }`}
              >
                Critical ({counts.distinct.critical})
              </button>
              <button
                onClick={() => setSeverityFilter('high')}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  severityFilter === 'high'
                    ? 'bg-amber-500 font-semibold text-black'
                    : 'text-[#aaa69e] hover:bg-white/[.05]'
                }`}
              >
                High ({counts.distinct.high})
              </button>
              <button
                onClick={() => setSeverityFilter('medium')}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  severityFilter === 'medium'
                    ? 'bg-yellow-500 font-semibold text-black'
                    : 'text-[#aaa69e] hover:bg-white/[.05]'
                }`}
              >
                Medium ({counts.distinct.medium})
              </button>

              {counts.distinct.low > 0 && (
                <button
                  onClick={() => setShowLow(!showLow)}
                  className={`rounded border px-2 py-1 font-mono text-[11px] transition ${
                    showLow
                      ? 'border-slate-400 bg-slate-500/20 text-white'
                      : 'border-white/[.08] text-[#77736c] hover:bg-white/[.05]'
                  }`}
                >
                  {showLow ? 'Hide Low Priority' : `Show Low Debt (${counts.distinct.low})`}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 font-mono text-[10px] uppercase text-[#77736c]">Category:</span>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="rounded border border-white/[.1] bg-black/40 px-2 py-1 text-xs text-[#c8c4bc] focus:border-amber-400 focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="security">Security</option>
                <option value="reliability">Reliability</option>
                <option value="correctness">Correctness</option>
                <option value="maintainability">Maintainability</option>
              </select>
            </div>
          </div>

          {/* Grouped Issues List */}
          {filteredIssues.length === 0 ? (
            <div className="card flex flex-col items-center justify-center p-8 text-center reveal">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                <ShieldCheck size={24} />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">
                No high-priority issues detected by the available checks.
              </h3>
              <p className="mt-1 max-w-md text-xs leading-5 text-[#77736c]">
                The repository passed all current AST and heuristic checks with zero critical, high, or medium severity risks flagged.
                (Note: static analysis evaluates detectable code patterns and does not guarantee the complete absence of all vulnerabilities).
              </p>
              {counts.distinct.low > 0 && !showLow && (
                <button
                  onClick={() => setShowLow(true)}
                  className="mt-4 rounded border border-white/[.1] px-3 py-1.5 font-mono text-xs text-[#aaa69e] hover:bg-white/[.04]"
                >
                  Inspect {counts.distinct.low} low-priority technical debt markers
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((group, i) => {
                const isExpanded = !!expandedIssueIds[group.id]
                const primaryOcc = group.occurrences[0]
                const ghLink = makeGithubLink(group.file_path, primaryOcc?.line)
                const isHighlighted = highlightedIssueId && group.occurrences.some(o => o.id === highlightedIssueId)

                return (
                  <div
                    key={group.id}
                    id={`issue-${group.id}`}
                    className={`card overflow-hidden p-4 transition-all duration-200 reveal ${
                      isHighlighted
                        ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-400/[.03]'
                        : 'hover:border-white/[.18]'
                    }`}
                    style={{ animationDelay: `${Math.min(i, 6) * 35}ms` }}
                  >
                    {/* Top Row: Title, Badges, Occurrences count */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {primaryOcc?.rule_id && (
                            <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold text-amber-300">
                              {primaryOcc.rule_id}
                            </span>
                          )}
                          <h3 className="text-sm font-semibold text-white">{group.title}</h3>
                          {getSeverityBadge(group.severity)}
                          <span className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.2 font-mono text-[9px] uppercase text-emerald-400">
                            {primaryOcc?.confidence_classification || group.confidence} Conf.
                          </span>
                          {primaryOcc?.evidence_type && (
                            <span className="rounded border border-blue-500/20 bg-blue-500/5 px-1.5 py-0.2 font-mono text-[9px] uppercase text-blue-300">
                              {primaryOcc.evidence_type.replace('_', ' ')}
                            </span>
                          )}
                          <span className="rounded border border-white/[.08] bg-white/[.03] px-1.5 py-0.2 font-mono text-[9px] uppercase text-[#77736c]">
                            {group.category}
                          </span>
                          {group.occurrenceCount > 1 && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.2 font-mono text-[10px] font-semibold text-amber-300">
                              {group.occurrenceCount} occurrences
                            </span>
                          )}
                        </div>

                        {/* Location Preview */}
                        {group.file_path && (
                          <div className="mt-2 flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-[#66625b]">File:</span>
                            {ghLink ? (
                              <a
                                href={ghLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-amber-300/90 underline-offset-2 hover:text-amber-300 hover:underline"
                              >
                                {group.file_path}
                                {primaryOcc?.line ? `:${primaryOcc.line}` : ''}
                                <ExternalLink size={10} className="opacity-70" />
                              </a>
                            ) : (
                              <span className="text-amber-300/80">{group.file_path}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => toggleExpand(group.id)}
                        className="shrink-0 rounded p-1 text-[#77736c] hover:bg-white/[.05] hover:text-white"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {/* EXPANDED SECTION (What is wrong, Why it matters, Evidence, Suggested fix, Related occurrences) */}
                    {(isExpanded || group.severity === 'critical') && (
                      <div className="mt-4 space-y-3.5 border-t border-white/[.07] pt-3.5 text-xs">
                        {/* What is wrong? */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                            What is wrong?
                          </div>
                          <p className="mt-1 leading-5 text-[#c8c4bc]">
                            {primaryOcc?.description || group.why_it_matters}
                          </p>
                        </div>

                        {/* Why does it matter? */}
                        {group.why_it_matters && (
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                              Why does it matter?
                            </div>
                            <p className="mt-1 leading-5 text-[#c8c4bc]">{group.why_it_matters}</p>
                          </div>
                        )}

                        {/* Primary Evidence */}
                        {primaryOcc?.evidence && (
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                                Evidence {primaryOcc.line ? `(line ${primaryOcc.line})` : ''}
                              </span>
                            </div>
                            <pre className="mt-1 max-h-36 overflow-x-auto rounded border border-white/[.07] bg-black/40 p-2.5 font-mono text-[11px] leading-5 text-amber-200/90">
                              <code>{primaryOcc.evidence}</code>
                            </pre>
                          </div>
                        )}

                        {/* How to fix it */}
                        {group.suggested_fix && (
                          <div className="rounded border border-emerald-500/20 bg-emerald-500/[.03] p-3">
                            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                              <CheckCircle2 size={13} /> How to fix it
                            </div>
                            <p className="mt-1 text-xs leading-5 text-[#d0ede0]">{group.suggested_fix}</p>
                          </div>
                        )}

                        {/* Related Occurrences (when count > 1) */}
                        {group.occurrences.length > 1 && (
                          <div className="rounded border border-white/[.06] bg-white/[.015] p-3">
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                              All Related Occurrences in this file ({group.occurrences.length})
                            </div>
                            <div className="mt-2 space-y-2">
                              {group.occurrences.map((occ, idx) => {
                                const occLink = makeGithubLink(group.file_path, occ.line)
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-start justify-between gap-3 border-t border-white/[.04] pt-1.5 text-[11px]"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <span className="font-mono text-amber-300">
                                        Occurrence {idx + 1} — line {occ.line || 'N/A'}:
                                      </span>
                                      {occ.evidence && (
                                        <div className="mt-0.5 font-mono text-[10px] text-[#aaa69e] truncate">
                                          {occ.evidence}
                                        </div>
                                      )}
                                    </div>
                                    {occLink && (
                                      <a
                                        href={occLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-amber-300/80 hover:text-amber-300"
                                      >
                                        GitHub <ExternalLink size={9} />
                                      </a>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: RECOMMENDED IMPROVEMENTS (Fix Now vs Improve Later) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          {/* Explanation Header */}
          <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-4 text-xs text-[#aaa69e] leading-5">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Wrench size={15} className="text-amber-400" />
              <span>Evidence-Backed Architectural Improvements</span>
            </div>
            <p className="mt-1">
              While <span className="text-white">Detected Issues</span> represents concrete code defects, these <span className="text-white">Recommended Improvements</span> are broader engineering initiatives derived from dependency structures, diagnostic patterns, and system complexity.
            </p>
          </div>

          {/* Sub-filter tabs */}
          <div className="flex items-center gap-2 border-b border-white/[.06] pb-2">
            <button
              onClick={() => setRecFilter('all')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                recFilter === 'all' ? 'bg-amber-400 text-black font-semibold' : 'text-[#aaa69e] hover:text-white'
              }`}
            >
              All Improvements ({recommendations.length})
            </button>
            <button
              onClick={() => setRecFilter('fix_now')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                recFilter === 'fix_now' ? 'bg-rose-500 text-white font-semibold' : 'text-[#aaa69e] hover:text-white'
              }`}
            >
              <Flame size={12} />
              <span>Fix Now ({fixNowRecs.length})</span>
            </button>
            <button
              onClick={() => setRecFilter('improve_later')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                recFilter === 'improve_later' ? 'bg-sky-500 text-white font-semibold' : 'text-[#aaa69e] hover:text-white'
              }`}
            >
              <Sparkles size={12} />
              <span>Improve Later ({improveLaterRecs.length})</span>
            </button>
          </div>

          {filteredRecs.length === 0 ? (
            <div className="card p-8 text-center text-xs text-[#77736c]">
              No high-value improvements identified from the available analysis.
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION: FIX NOW */}
              {fixNowRecs.length > 0 && (recFilter === 'all' || recFilter === 'fix_now') && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-rose-500" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-rose-400">
                      Fix Now (Urgent Remediation)
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {fixNowRecs.map((rec, i) => (
                      <RecommendationCard
                        key={rec.id || i}
                        rec={rec}
                        index={i}
                        onNavigateIssues={() => navigateToRelatedIssues(rec.related_finding_ids)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: IMPROVE LATER */}
              {improveLaterRecs.length > 0 && (recFilter === 'all' || recFilter === 'improve_later') && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-sky-400" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400">
                      Improve Later (Strategic Architecture & Technical Debt)
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {improveLaterRecs.map((rec, i) => (
                      <RecommendationCard
                        key={rec.id || i}
                        rec={rec}
                        index={i}
                        onNavigateIssues={() => navigateToRelatedIssues(rec.related_finding_ids)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecommendationCard({
  rec,
  index,
  onNavigateIssues,
}: {
  rec: Recommendation
  index: number
  onNavigateIssues: () => void
}) {
  const [expanded, setExpanded] = useState<boolean>(true)
  const isFixNow = (rec.priority || '').toLowerCase().includes('fix') || (rec.priority || '').toLowerCase().includes('now')
  const why = rec.why_it_matters || rec.explanation
  const how = rec.recommended_approach || rec.solution

  return (
    <div className="card overflow-hidden p-4 transition-all duration-200 hover:border-white/[.18]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-amber-400">0{index + 1}</span>
            <h4 className="text-sm font-semibold text-white">{rec.title}</h4>
            <span
              className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase font-bold border ${
                isFixNow
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
              }`}
            >
              {rec.priority}
            </span>
            <span className="rounded border border-white/[.08] bg-white/[.03] px-2 py-0.5 font-mono text-[9px] uppercase text-[#77736c]">
              {rec.category}
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded p-1 text-[#77736c] hover:bg-white/[.05] hover:text-white"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3.5 space-y-3 border-t border-white/[.06] pt-3 text-xs text-[#aaa69e]">
          {/* Why it matters */}
          {why && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">Why it matters</div>
              <p className="mt-1 leading-5 text-[#c8c4bc]">{why}</p>
            </div>
          )}

          {/* Evidence */}
          {rec.evidence && (
            <div className="rounded border border-white/[.07] bg-black/30 p-2.5 font-mono text-[11px] text-amber-300/90 overflow-x-auto">
              <span className="text-[#66625b] mr-2">Evidence:</span>
              {rec.evidence}
            </div>
          )}

          {/* Recommended approach */}
          {how && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#77736c]">
                Recommended Implementation
              </div>
              <p className="mt-1 leading-5 text-[#e0ded8]">{how}</p>
            </div>
          )}

          {/* Expected benefit */}
          {rec.expected_benefit && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Expected Benefit: {rec.expected_benefit}</span>
            </div>
          )}

          {/* Related issues link */}
          {rec.related_finding_ids && rec.related_finding_ids.length > 0 && (
            <div className="pt-1">
              <button
                onClick={onNavigateIssues}
                className="inline-flex items-center gap-1.5 rounded border border-amber-400/30 bg-amber-400/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-amber-300 hover:bg-amber-400/15"
              >
                <LinkIcon size={10} />
                <span>Related to {rec.related_finding_ids.length} detected issue(s) — View in Detected Issues</span>
                <ArrowRight size={10} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
