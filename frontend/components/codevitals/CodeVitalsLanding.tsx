'use client'

import React from 'react'
import {
  BrainCircuit,
  Compass,
  Layers,
  Users,
  ArrowRight,
  Sparkles,
  Trophy,
  Clock,
  CheckCircle2,
  Calendar,
  Flame,
} from 'lucide-react'
import type { Analysis } from '@/lib/api'

interface CodeVitalsLandingProps {
  analysis: Analysis | null
  onSelectOption: (option: 'complete' | 'component' | 'team') => void
  history: any[]
  teamSessions: any[]
  onOpenSession: (sessionId: string) => void
  onOpenTeamDashboard: (teamSessionId: string) => void
}

export function CodeVitalsLanding({
  analysis,
  onSelectOption,
  history,
  teamSessions,
  onOpenSession,
  onOpenTeamDashboard,
}: CodeVitalsLandingProps) {
  return (
    <div className="space-y-8 reveal">
      {/* HERO BANNER */}
      <div className="border-b border-white/[.08] pb-6">
        <div className="flex items-center gap-2 text-amber-300">
          <BrainCircuit size={18} />
          <span className="font-mono text-[10px] uppercase tracking-[.18em]">CodeVitals 2.0</span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-white">
          Understand your project. Test your knowledge. Prepare your team.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#aaa69e]">
          Evidence-grounded codebase assessments derived directly from actual repository architecture,
          dependencies, routes, and implementation details.
        </p>
      </div>

      {/* 3 PRIMARY ASSESSMENT OPTIONS */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* OPTION 1 — COMPLETE CODEBASE */}
        <div className="card relative flex flex-col justify-between p-5 sm:p-6 border-white/[.12] hover:border-amber-400/60 transition group">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Compass size={22} />
            </div>

            <div className="mt-4 font-mono text-[9px] uppercase tracking-wider text-amber-400 font-semibold">
              Option 01 / Individual
            </div>
            <h2 className="mt-1 text-lg font-bold text-white group-hover:text-amber-300 transition">
              Complete Codebase
            </h2>

            <p className="mt-2 text-xs leading-5 text-[#aaa69e]">
              Evaluate your understanding of the entire repository, from architecture and application logic to
              dependencies and integration.
            </p>

            <div className="mt-4 space-y-1.5 border-t border-white/[.06] pt-3 text-[11px] text-[#8e8a82]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>End-to-end architecture & data flow</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>10, 20, or 30 grounded questions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span>Category-by-category knowledge breakdown</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectOption('complete')}
            className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-amber-300 active:scale-[.99]"
          >
            <span>Start Complete Assessment</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* OPTION 2 — COMPONENT ASSESSMENT */}
        <div className="card relative flex flex-col justify-between p-5 sm:p-6 border-white/[.12] hover:border-sky-400/60 transition group">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-sky-400 border border-sky-400/20">
              <Layers size={22} />
            </div>

            <div className="mt-4 font-mono text-[9px] uppercase tracking-wider text-sky-400 font-semibold">
              Option 02 / Focused
            </div>
            <h2 className="mt-1 text-lg font-bold text-white group-hover:text-sky-300 transition">
              Component Assessment
            </h2>

            <p className="mt-2 text-xs leading-5 text-[#aaa69e]">
              Focus on specific parts of the project, such as frontend, backend, database, APIs, authentication, or
              other detected modules.
            </p>

            <div className="mt-4 space-y-1.5 border-t border-white/[.06] pt-3 text-[11px] text-[#8e8a82]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-sky-400 shrink-0" />
                <span>Dynamically detected from repository anatomy</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-sky-400 shrink-0" />
                <span>Single or multi-component focus</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-sky-400 shrink-0" />
                <span>Includes cross-component boundaries</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectOption('component')}
            className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/15 px-4 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-400/25 active:scale-[.99]"
          >
            <span>Choose Components</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* OPTION 3 — TEAM ASSESSMENT & HACKATHON READINESS */}
        <div className="card relative flex flex-col justify-between p-5 sm:p-6 border-white/[.12] hover:border-purple-400/60 transition group">
          <div className="absolute top-4 right-4">
            <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-purple-300">
              Hackathon Ready
            </span>
          </div>

          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-400/10 text-purple-400 border border-purple-400/20">
              <Users size={22} />
            </div>

            <div className="mt-4 font-mono text-[9px] uppercase tracking-wider text-purple-400 font-semibold">
              Option 03 / Collaborative
            </div>
            <h2 className="mt-1 text-lg font-bold text-white group-hover:text-purple-300 transition">
              Team Assessment
            </h2>

            <p className="mt-2 text-xs leading-5 text-[#aaa69e]">
              Create a shared assessment session, assign responsibilities to teammates, and evaluate your team's
              project knowledge.
            </p>

            <div className="mt-4 space-y-1.5 border-t border-white/[.06] pt-3 text-[11px] text-[#8e8a82]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-purple-400 shrink-0" />
                <span>Shareable link for WhatsApp & group chats</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-purple-400 shrink-0" />
                <span>70% assigned role + 30% shared architecture</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-purple-400 shrink-0" />
                <span>Knowledge coverage matrix & mock judge Q&A</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectOption('team')}
            className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-purple-400/40 bg-purple-400/15 px-4 py-2.5 text-xs font-bold text-purple-300 transition hover:bg-purple-400/25 active:scale-[.99]"
          >
            <span>Create Team Session</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* TEAM SESSIONS SECTION (IF ANY EXIST) */}
      {teamSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[.08] pb-2">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Active Team Sessions</h3>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {teamSessions.map(t => (
              <div
                key={t.id}
                onClick={() => onOpenTeamDashboard(t.id)}
                className="card p-4 hover:border-purple-400/60 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{t.team_name}</span>
                    {t.is_hackathon_mode && (
                      <span className="rounded bg-purple-500/15 px-1.5 py-0.2 font-mono text-[9px] text-purple-300 border border-purple-500/30">
                        Hackathon
                      </span>
                    )}
                  </div>
                  {t.description && <p className="mt-1 text-xs text-[#aaa69e] line-clamp-1">{t.description}</p>}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/[.06] pt-2 text-xs font-mono text-[#8e8a82]">
                  <span>
                    {t.completed_members} / {t.total_members} completed
                  </span>
                  <span className="text-purple-400 font-semibold flex items-center gap-1">
                    <span>Open Dashboard</span>
                    <ArrowRight size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECENT INDIVIDUAL ASSESSMENT HISTORY */}
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/[.08] pb-2">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Previous Assessment Attempts</h3>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {history.slice(0, 6).map(item => (
              <div
                key={item.id}
                onClick={() => onOpenSession(item.id)}
                className="card p-3.5 hover:border-amber-400/50 transition cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-xs truncate">
                      {item.assessment_type === 'component' ? 'Component Assessment' : 'Complete Codebase'}
                    </span>
                    <span className="rounded bg-white/[.04] px-1.5 py-0.2 font-mono text-[9px] uppercase text-[#8e8a82]">
                      {item.difficulty}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[#6d6962]">
                    {new Date(item.created_at).toLocaleDateString()} · {item.question_count} questions
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {item.score !== null ? (
                    <div className="font-mono text-base font-bold text-amber-300">
                      {item.score}
                      <span className="text-[10px] text-[#77736c]">/100</span>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-amber-400/80">In Progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
