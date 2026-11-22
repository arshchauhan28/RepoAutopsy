'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  Copy,
  Check,
  Share2,
  Trophy,
  Activity,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import type { TeamSessionData } from '@/lib/api'
import { getTeamSession } from '@/lib/api'

interface TeamDashboardProps {
  teamSessionId: string
  organizerToken?: string
  onBack: () => void
  onOpenMemberAssessment: (sessionId: string) => void
}

export function TeamDashboard({
  teamSessionId,
  organizerToken,
  onBack,
  onOpenMemberAssessment,
}: TeamDashboardProps) {
  const [data, setData] = useState<TeamSessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    getTeamSession(teamSessionId, organizerToken)
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load team dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [teamSessionId, organizerToken])

  const inviteUrl =
    typeof window !== 'undefined' && data?.invite_token
      ? `${window.location.origin}/codevitals/invite/${data.invite_token}`
      : data?.invite_token
      ? `/codevitals/invite/${data.invite_token}`
      : ''

  const handleCopy = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Join our ${data?.team_name || 'CodeVitals'} Codebase Assessment on RepoAutopsy: ${inviteUrl}`
  )}`

  if (loading && !data) {
    return (
      <div className="card max-w-4xl mx-auto p-12 text-center text-sm text-[#77736c] reveal">
        <RefreshCw size={24} className="animate-spin mx-auto text-purple-400 mb-3" />
        Loading Team Assessment Dashboard…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card max-w-2xl mx-auto p-6 border-rose-400/20 bg-rose-400/[.05] text-rose-300 reveal">
        <h3 className="font-bold text-sm">Failed to load team session</h3>
        <p className="mt-1 text-xs text-rose-300/80">{error}</p>
        <button
          onClick={onBack}
          className="mt-4 rounded border border-white/[.15] px-3 py-1.5 text-xs text-white"
        >
          Back to CodeVitals
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 reveal">
      {/* TOP BAR */}
      <div className="flex items-center justify-between border-b border-white/[.08] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[#8e8a82] hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Back to CodeVitals</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-white/[.1] bg-black/40 px-3 py-1.5 text-xs text-[#aaa69e] hover:text-white"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* TEAM HEADER & PROGRESS OVERVIEW */}
      <div className="card p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-purple-400 font-bold">
                Team Assessment Session
              </span>
              {data.is_hackathon_mode && (
                <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.2 font-mono text-[9px] font-bold text-purple-300">
                  Hackathon Readiness
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-white">{data.team_name}</h1>
            {data.description && <p className="mt-1 text-xs text-[#aaa69e]">{data.description}</p>}
          </div>

          {data.team_average_score !== null && (
            <div className="rounded-xl border border-purple-400/30 bg-purple-400/[.06] p-3 text-center sm:text-right shrink-0">
              <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                Team Average Score
              </div>
              <div className="font-mono text-3xl font-extrabold text-white mt-0.5">
                {data.team_average_score}
                <span className="text-base text-[#77736c]">/100</span>
              </div>
            </div>
          )}
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="card p-3 bg-black/40 border-white/[.07]">
            <div className="font-mono text-[9px] uppercase text-[#77736c]">Total Members</div>
            <div className="mt-1 font-mono text-xl font-bold text-white">{data.total_members}</div>
          </div>
          <div className="card p-3 bg-black/40 border-white/[.07]">
            <div className="font-mono text-[9px] uppercase text-emerald-400">Completed</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-300">{data.completed_members}</div>
          </div>
          <div className="card p-3 bg-black/40 border-white/[.07]">
            <div className="font-mono text-[9px] uppercase text-amber-400">In Progress</div>
            <div className="mt-1 font-mono text-xl font-bold text-amber-300">{data.in_progress_members}</div>
          </div>
          <div className="card p-3 bg-black/40 border-white/[.07]">
            <div className="font-mono text-[9px] uppercase text-[#8e8a82]">Pending Joins</div>
            <div className="mt-1 font-mono text-xl font-bold text-[#c8c4bc]">{data.invited_members}</div>
          </div>
        </div>

        {/* SHAREABLE INVITATION LINK CARD */}
        <div className="rounded-xl border border-purple-400/25 bg-purple-400/[.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Share2 size={14} className="text-purple-400" />
              <span>Shareable Invitation Link (WhatsApp, Discord, Slack)</span>
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-purple-300/80 bg-black/40 p-2 rounded border border-white/[.08]">
              {inviteUrl}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/[.15] bg-white/[.05] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[.1] transition"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition"
            >
              <span>Share to WhatsApp</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* TEAM MEMBERS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/[.08] pb-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Teammate Assessment Results ({data.members.length})
            </h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.members.map(m => (
            <div
              key={m.id}
              className="card p-4 border-white/[.1] flex flex-col justify-between hover:border-white/[.2] transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold text-white text-sm block truncate">{m.display_name}</span>
                    <span className="text-[11px] text-purple-300 font-mono">{m.assigned_role || 'Member'}</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase shrink-0 ${
                      m.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : m.status === 'in_progress'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/[.05] text-[#8e8a82] border border-white/[.08]'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="mt-3 font-mono text-[10px] text-[#77736c]">
                  Scope:{' '}
                  <span className="text-[#c8c4bc]">
                    {m.assigned_components.includes('complete')
                      ? 'Complete Codebase'
                      : m.assigned_components.join(', ')}
                  </span>
                </div>

                {/* Score */}
                <div className="mt-3 border-t border-white/[.06] pt-2 flex items-center justify-between">
                  <span className="text-xs text-[#8e8a82]">Assessment Score</span>
                  {m.score !== null ? (
                    <span className="font-mono text-lg font-bold text-white">
                      {m.score}
                      <span className="text-xs text-[#77736c]">/100</span>
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-[#77736c]">Pending</span>
                  )}
                </div>

                {/* Category Pills if completed */}
                {m.category_scores && Object.keys(m.category_scores).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(m.category_scores).map(([cat, sc]) => (
                      <span
                        key={cat}
                        className="rounded bg-black/40 px-1.5 py-0.2 font-mono text-[9px] text-[#aaa69e] border border-white/[.05]"
                      >
                        {cat}: <strong className="text-white">{sc}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPONENT KNOWLEDGE COVERAGE MATRIX (PHASE 16) */}
      {data.coverage_matrix && data.coverage_matrix.length > 0 && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-purple-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Team Knowledge Coverage Matrix
              </h2>
            </div>
            <span className="font-mono text-[10px] text-[#77736c]">
              Verifies which subsystems have been evaluated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[.08] text-[10px] uppercase font-mono text-[#77736c]">
                  <th className="py-2 pr-4">Subsystem Component</th>
                  <th className="py-2 px-3">Layer</th>
                  <th className="py-2 px-3">Files</th>
                  <th className="py-2 px-3">Coverage Status</th>
                  <th className="py-2 pl-3">Assigned / Evaluated Teammates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[.04]">
                {data.coverage_matrix.map(row => (
                  <tr key={row.component_id} className="hover:bg-white/[.015] transition">
                    <td className="py-2.5 pr-4 font-semibold text-white">{row.component_name}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-[#aaa69e] capitalize">{row.layer}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-[#77736c]">{row.file_count}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase font-bold ${
                          row.status === 'assessed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : row.status === 'in_progress'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-white/[.05] text-[#8e8a82] border border-white/[.08]'
                        }`}
                      >
                        {row.status === 'assessed'
                          ? 'Assessed'
                          : row.status === 'in_progress'
                          ? 'In Progress'
                          : 'Not Yet Assessed'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 font-mono text-[11px] text-[#c8c4bc]">
                      {row.completed_members.length > 0 ? (
                        <span className="text-emerald-300">
                          {row.completed_members.join(', ')} (Completed)
                        </span>
                      ) : row.assigned_members.length > 0 ? (
                        <span className="text-amber-300/80">
                          {row.assigned_members.join(', ')} (Assigned)
                        </span>
                      ) : (
                        <span className="text-[#66625b]">None assigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TEAM INSIGHTS & HACKATHON READINESS */}
      {(data.team_strengths?.length > 0 ||
        data.team_knowledge_gaps?.length > 0 ||
        data.hackathon_insights?.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Strengths & Alignment */}
          <div className="card p-5 border-emerald-500/20 bg-emerald-500/[.03] space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 size={14} />
              <span>Demonstrated Team Strengths</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#d0ede0]">
              {(data.team_strengths || []).map((s, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gaps & Judge Preparation */}
          <div className="card p-5 border-amber-500/20 bg-amber-500/[.03] space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-400 uppercase tracking-wider">
              <AlertCircle size={14} />
              <span>Areas Requiring Coordination & Judge Prep</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#fae8c8]">
              {(data.team_knowledge_gaps || []).map((g, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{g}</span>
                </li>
              ))}
              {(data.hackathon_insights || []).map((h, idx) => (
                <li key={`h-${idx}`} className="flex items-start gap-2 text-purple-200">
                  <span className="text-purple-400 font-bold">★</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

