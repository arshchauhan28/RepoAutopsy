'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Users,
  ShieldCheck,
  Cpu,
  HelpCircle,
} from 'lucide-react'
import type { AssessmentSession, AssessmentTurn } from '@/lib/api'

interface AssessmentResultsProps {
  session: AssessmentSession
  analysisId: string
  onRetake: () => void
  onViewTeamDashboard?: (teamSessionId: string) => void
}

export function AssessmentResults({
  session,
  analysisId,
  onRetake,
  onViewTeamDashboard,
}: AssessmentResultsProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({})

  const score = session.score ?? 0
  const feedback = session.feedback || {}
  const categoryScores = session.category_scores || {}

  const toggleTurn = (turnId: string) => {
    setExpandedTurns(prev => ({ ...prev, [turnId]: !prev[turnId] }))
  }

  const expandAll = () => {
    const next: Record<string, boolean> = {}
    session.turns.forEach(t => {
      next[t.id] = true
    })
    setExpandedTurns(next)
  }

  const collapseAll = () => {
    setExpandedTurns({})
  }

  // Determine score verdict tier
  let scoreVerdict = 'Needs Codebase Review'
  let scoreColor = 'text-rose-400'
  let badgeColor = 'bg-rose-500/10 border-rose-500/30 text-rose-300'
  if (score >= 85) {
    scoreVerdict = 'Codebase Master / Architecture Lead'
    scoreColor = 'text-emerald-400'
    badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
  } else if (score >= 70) {
    scoreVerdict = 'Proficient / Active Contributor'
    scoreColor = 'text-amber-400'
    badgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-300'
  } else if (score >= 50) {
    scoreVerdict = 'Developing Familiarity'
    scoreColor = 'text-yellow-400'
    badgeColor = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
  }

  // Filter turns
  const filteredTurns = session.turns.filter(turn => {
    if (filterCategory === 'all') return true
    if (filterCategory === 'incorrect') {
      const earned = turn.earned_score ?? 0
      const max = turn.max_score || 5
      return earned < max
    }
    return turn.category?.toLowerCase() === filterCategory.toLowerCase()
  })

  // Categories list
  const categories = Array.from(new Set(session.turns.map(t => t.category).filter(Boolean)))

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HERO SCORE CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-gradient-to-b from-[#181816] to-[#10100f] p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
            <div className="relative grid h-20 w-20 place-items-center rounded-2xl border border-white/[.15] bg-white/[.03] shadow-inner">
              <Trophy size={36} className={scoreColor} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-[#9e9a91]">
                <span>{session.participant_name ? `${session.participant_name}'s Assessment` : 'CodeVitals Evaluation'}</span>
                <span>•</span>
                <span className="capitalize">{session.scope_type || session.assessment_type} Scope</span>
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Assessment Results
              </h2>
              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}>
                  {scoreVerdict}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-white/[.08] bg-white/[.02] px-2.5 py-0.5 font-mono text-[11px] text-[#8e8a82]">
                  <Cpu size={12} className="text-amber-400" />
                  {session.evaluation_mode === 'hybrid' ? 'AI-Assisted Evaluation' : 'Evidence-Based Rubric'}
                </span>
              </div>
            </div>
          </div>

          {/* SCORE CIRCLE / PILL */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[.1] bg-black/40 px-8 py-5 min-w-[180px] shadow-lg">
            <span className="font-mono text-[10px] uppercase tracking-[.2em] text-[#8e8a82]">Final Score</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-5xl font-extrabold tracking-tight ${scoreColor}`}>{Math.round(score)}</span>
              <span className="font-mono text-xl text-[#66625b]">/100</span>
            </div>
            <span className="mt-1 font-mono text-[10px] text-[#8a867f]">
              {session.turns.length} Questions Evaluated
            </span>
          </div>
        </div>

        {/* FEEDBACK SUMMARY */}
        {feedback.summary && (
          <div className="mt-6 border-t border-white/[.08] pt-5 text-sm leading-relaxed text-[#c4c0b6]">
            <p>{feedback.summary}</p>
          </div>
        )}

        {/* ACTIONS ROW */}
        <div className="mt-6 flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={onRetake}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[.12] bg-white/[.04] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[.08]"
          >
            <RotateCcw size={14} />
            <span>Retake Assessment</span>
          </button>

          {session.team_session_id && onViewTeamDashboard && (
            <button
              onClick={() => onViewTeamDashboard(session.team_session_id!)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              <Users size={14} />
              <span>Back to Team Dashboard</span>
            </button>
          )}

          <Link
            href={`/repositories/${analysisId}/report`}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400 px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-amber-300 ml-auto"
          >
            <span>View Full Case Report</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* CATEGORY BREAKDOWNS & STRENGTHS / GAPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CATEGORY SCORES */}
        <div className="rounded-xl border border-white/[.08] bg-[#141412] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-[10px] uppercase tracking-wider mb-4">
            <Layers size={14} />
            <span>Category Performance</span>
          </div>

          <div className="space-y-3.5">
            {Object.keys(categoryScores).length > 0 ? (
              Object.entries(categoryScores).map(([cat, val]) => {
                const pct = Math.min(100, Math.max(0, Math.round(Number(val))))
                let barColor = 'bg-rose-500'
                if (pct >= 80) barColor = 'bg-emerald-400'
                else if (pct >= 60) barColor = 'bg-amber-400'
                else if (pct >= 40) barColor = 'bg-yellow-400'

                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize font-medium text-[#c4c0b6]">{cat.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-[11px] text-[#9e9a91]">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[.06]">
                      <div
                        className={`h-full ${barColor} transition-all duration-700 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-[#8e8a82]">No category scores recorded for this session.</p>
            )}
          </div>
        </div>

        {/* STRENGTHS & KNOWLEDGE GAPS */}
        <div className="space-y-4">
          {/* STRENGTHS */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.03] p-4.5">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] uppercase tracking-wider mb-2.5">
              <CheckCircle2 size={14} />
              <span>Demonstrated Strengths</span>
            </div>
            {feedback.strengths && feedback.strengths.length > 0 ? (
              <ul className="space-y-1.5">
                {feedback.strengths.map((str: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-[#d1cec7] leading-relaxed">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#8e8a82]">Consistent solid responses across core questions.</p>
            )}
          </div>

          {/* GAPS */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[.03] p-4.5">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-[10px] uppercase tracking-wider mb-2.5">
              <AlertTriangle size={14} />
              <span>Key Knowledge Gaps & Review Areas</span>
            </div>
            {(feedback.knowledge_gaps && feedback.knowledge_gaps.length > 0) ||
            (feedback.weaknesses && feedback.weaknesses.length > 0) ? (
              <ul className="space-y-1.5">
                {(feedback.knowledge_gaps || feedback.weaknesses).map((gap: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-[#d1cec7] leading-relaxed">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#8e8a82]">No major technical gaps detected.</p>
            )}
          </div>
        </div>
      </div>

      {/* QUESTION BY QUESTION BREAKDOWN */}
      <div className="rounded-xl border border-white/[.08] bg-[#141412] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[.08] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Question-by-Question Review</h3>
            <p className="text-xs text-[#8e8a82] mt-0.5">
              Inspect earned points, rubrics, correct answers, and repository evidence
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="inline-flex rounded-lg border border-white/[.08] bg-white/[.02] p-0.5 text-[11px]">
              <button
                onClick={() => setFilterCategory('all')}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  filterCategory === 'all'
                    ? 'bg-amber-400 text-black font-semibold'
                    : 'text-[#9e9a91] hover:text-white'
                }`}
              >
                All ({session.turns.length})
              </button>
              <button
                onClick={() => setFilterCategory('incorrect')}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  filterCategory === 'incorrect'
                    ? 'bg-amber-400 text-black font-semibold'
                    : 'text-[#9e9a91] hover:text-white'
                }`}
              >
                Needs Review
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={expandAll}
                className="rounded border border-white/[.08] bg-white/[.02] px-2 py-1 text-[10px] font-mono uppercase text-[#8e8a82] hover:text-white"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="rounded border border-white/[.08] bg-white/[.02] px-2 py-1 text-[10px] font-mono uppercase text-[#8e8a82] hover:text-white"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>

        {/* TURN LIST */}
        <div className="mt-5 space-y-3.5">
          {filteredTurns.map((turn, idx) => {
            const isExpanded = expandedTurns[turn.id] ?? true
            const earned = turn.earned_score ?? (turn.evaluation?.score !== undefined ? Math.round((turn.evaluation.score / 100) * (turn.max_score || 5)) : 0)
            const max = turn.max_score || 5
            const isPerfect = earned >= max
            const isPartial = earned > 0 && earned < max

            return (
              <div
                key={turn.id}
                className={`rounded-xl border transition-all ${
                  isPerfect
                    ? 'border-emerald-500/20 bg-emerald-500/[.015]'
                    : isPartial
                    ? 'border-yellow-500/20 bg-yellow-500/[.015]'
                    : 'border-rose-500/20 bg-rose-500/[.015]'
                } overflow-hidden`}
              >
                {/* Header row */}
                <div
                  onClick={() => toggleTurn(turn.id)}
                  className="flex cursor-pointer items-start justify-between gap-4 p-4 hover:bg-white/[.02] transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="font-mono text-xs font-semibold text-amber-400 mt-0.5">
                      Q{turn.question_index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/[.08] bg-white/[.02] text-[#9e9a91]">
                          {turn.category}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                          {turn.difficulty}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">
                          {turn.question_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-white leading-snug">
                        {turn.question}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono font-semibold ${
                        isPerfect
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : isPartial
                          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {isPerfect ? (
                        <CheckCircle2 size={13} />
                      ) : isPartial ? (
                        <AlertTriangle size={13} />
                      ) : (
                        <XCircle size={13} />
                      )}
                      <span>
                        {earned} / {max} pts
                      </span>
                    </div>

                    <button className="text-[#8e8a82] hover:text-white">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/[.06] bg-black/20 p-4 space-y-3.5 text-xs">
                    {/* Code Snippet if present */}
                    {turn.code_snippet && (
                      <div className="rounded-lg border border-white/[.08] bg-[#0c0c0b] p-3 font-mono text-[11px] text-[#cfcac2] overflow-x-auto">
                        <pre>{turn.code_snippet}</pre>
                      </div>
                    )}

                    {/* Multiple choice Options review */}
                    {turn.question_type === 'multiple_choice' && turn.options && (
                      <div className="space-y-1.5">
                        <span className="font-mono text-[10px] uppercase text-[#8e8a82]">Options:</span>
                        <div className="space-y-1">
                          {turn.options.map((opt, optIdx) => {
                            const isSelected = turn.selected_option === optIdx
                            const isTurnCorrect = turn.evaluation?.correct_option === optIdx || (isSelected && isPerfect)
                            return (
                              <div
                                key={optIdx}
                                className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition ${
                                  isTurnCorrect
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                    : isSelected
                                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                                    : 'border-white/[.04] bg-white/[.01] text-[#9e9a91]'
                                }`}
                              >
                                <span className="font-mono text-[11px] font-bold">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span className="flex-1">{opt}</span>
                                {isTurnCorrect && (
                                  <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-400 shrink-0">
                                    Correct Answer
                                  </span>
                                )}
                                {isSelected && !isTurnCorrect && (
                                  <span className="font-mono text-[9px] uppercase tracking-wider text-rose-400 shrink-0">
                                    Your Choice
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* User Free-Text Answer */}
                    {turn.question_type !== 'multiple_choice' && turn.answer && (
                      <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-3 space-y-1">
                        <span className="font-mono text-[10px] uppercase text-[#8e8a82] block">Your Answer:</span>
                        <p className="text-[#d1cec7] whitespace-pre-wrap leading-relaxed">{turn.answer}</p>
                      </div>
                    )}

                    {/* Feedback / Explanation / Rubric */}
                    {(turn.explanation || turn.evaluation?.verdict || turn.evaluation?.rubric_notes) && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[.03] p-3 space-y-1">
                        <span className="font-mono text-[10px] uppercase text-amber-400 flex items-center gap-1.5">
                          <Sparkles size={12} />
                          <span>Evaluation Notes & Concept Breakdown:</span>
                        </span>
                        <p className="text-[#cfcac2] leading-relaxed">
                          {turn.explanation || turn.evaluation?.verdict || turn.evaluation?.rubric_notes}
                        </p>
                      </div>
                    )}

                    {/* Relevant Files & Grounding Evidence */}
                    {turn.relevant_files && turn.relevant_files.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="font-mono text-[10px] uppercase text-[#77736c] mr-1">
                          Repo Evidence:
                        </span>
                        {turn.relevant_files.map((file, fIdx) => (
                          <span
                            key={fIdx}
                            className="inline-flex items-center gap-1 rounded bg-white/[.04] border border-white/[.08] px-2 py-0.5 font-mono text-[10px] text-[#a8a49c]"
                          >
                            <FileCode size={11} className="text-amber-400" />
                            {file}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

