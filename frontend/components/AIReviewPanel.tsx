'use client'

import { useMemo } from 'react'
import { Sparkles, Cpu, CheckCircle2, AlertTriangle, ArrowRight, ShieldAlert, Layers, ExternalLink, HelpCircle } from 'lucide-react'
import type { CodebaseBriefing, Analysis } from '@/lib/api'
import { groupFindings } from '@/lib/grouping'

interface AIReviewPanelProps {
  analysis: Analysis
  onNavigateToDiagnostics?: () => void
  onNavigateToDoctor?: () => void
}

export function AIReviewPanel({ analysis, onNavigateToDiagnostics, onNavigateToDoctor }: AIReviewPanelProps) {
  const briefing: CodebaseBriefing = analysis.ai_insights || {}
  const handleNavigate = onNavigateToDiagnostics || onNavigateToDoctor

  const isAi = briefing.is_ai_generated ?? false
  const modeLabel = briefing.mode_label || (isAi ? 'AI-Assisted Case Report' : 'Static Analysis Case Report')
  const modelName = briefing.model || (isAi ? 'AI Model' : 'Deterministic Static Engine')

  const overview = briefing.project_overview
  const arch = briefing.architecture_assessment
  const strengths = briefing.architectural_strengths || arch?.strengths || briefing.strengths || []
  const concerns = briefing.architectural_concerns || arch?.concerns || []
  const limitations = briefing.analysis_limitations || [
    'Static code analysis evaluates syntax and structural patterns; runtime behavior and environmental variables cannot be fully established.',
    'Dynamic import paths and reflection-based module calls are not reflected in static dependency trees.',
  ]

  // Group findings authoritative counts separating distinct issues from occurrences
  const { counts } = useMemo(() => {
    return groupFindings(analysis.findings || [])
  }, [analysis.findings])

  // Legacy fallback if overview is missing
  const summaryText = overview?.summary || analysis.summary || briefing.summary || 'Repository analysis completed.'

  return (
    <div className="card space-y-7 p-5 sm:p-7 reveal">
      {/* HEADER: Title & Transparency Mode Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.08] pb-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
            / Case Report
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">Case Report</h2>
          <p className="mt-0.5 text-xs text-[#77736c]">
            An evidence-backed technical assessment of your repository.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAi ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-semibold text-amber-300">
              <Sparkles size={11} /> {modeLabel} ({modelName})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 font-mono text-[10px] font-semibold text-sky-300">
              <Cpu size={11} /> {modeLabel}
            </span>
          )}
        </div>
      </div>

      {/* COMPACT CROSS-REFERENCE LINK TO DIAGNOSTICS (NO DUPLICATE FINDINGS LIST!) */}
      {counts.distinct.totalHighPriority > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[.03] p-3.5">
          <div className="flex items-center gap-2.5 text-xs text-[#d8d4cb]">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <span>
              <strong className="text-white">
                {counts.distinct.totalHighPriority} distinct issue{counts.distinct.totalHighPriority === 1 ? '' : 's'} identified across {counts.occurrences.totalHighPriority} occurrence{counts.occurrences.totalHighPriority === 1 ? '' : 's'}.
              </strong>
              {" "}
              ({counts.distinct.critical} critical, {counts.distinct.high} high, {counts.distinct.medium} medium).
            </span>
          </div>

          {handleNavigate && (
            <button
              onClick={handleNavigate}
              className="inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-3 py-1 text-xs font-semibold text-black transition hover:bg-amber-300"
            >
              <span>Explore in Diagnostics</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* 01 / PROJECT OVERVIEW */}
      <section className="space-y-3">
        <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
          01 / Project Overview
        </div>
        <p className="text-sm leading-6 text-[#c8c4bc]">{summaryText}</p>

        {overview?.primary_purpose && overview.primary_purpose !== 'No repository description provided.' && (
          <div className="rounded border border-white/[.06] bg-white/[.02] p-3 text-xs leading-5 text-[#aaa69e]">
            <span className="font-semibold text-white">Primary Purpose: </span>
            {overview.primary_purpose}
          </div>
        )}

        {overview?.technologies && overview.technologies.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-[#77736c]">Verified Stack:</span>
            {overview.technologies.map(tech => (
              <span
                key={tech}
                className="rounded border border-white/[.08] bg-white/[.03] px-2 py-0.5 font-mono text-[10px] text-[#c8c4bc]"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        {overview?.codebase_organization && (
          <div className="text-xs leading-5 text-[#8a867f]">
            <span className="font-mono text-[10px] uppercase text-[#77736c]">Organization: </span>
            {overview.codebase_organization}
          </div>
        )}
      </section>

      {/* 02 / ARCHITECTURE ASSESSMENT */}
      <section className="space-y-3 border-t border-white/[.06] pt-5">
        <div className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-400">
          02 / Architecture Assessment
        </div>

        {arch?.component_relationships ? (
          <p className="text-xs leading-5 text-[#aaa69e]">{arch.component_relationships}</p>
        ) : briefing.architecture_explanation ? (
          <p className="text-xs leading-5 text-[#aaa69e]">{briefing.architecture_explanation}</p>
        ) : null}

        {/* Structural Sub-details */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {arch?.frontend_backend_separation && (
            <div className="rounded border border-white/[.06] bg-white/[.015] p-3 text-xs">
              <span className="font-mono text-[10px] uppercase text-[#77736c]">Layer Boundaries</span>
              <p className="mt-1 text-[#c8c4bc]">{arch.frontend_backend_separation}</p>
            </div>
          )}

          {arch?.data_persistence && (
            <div className="rounded border border-white/[.06] bg-white/[.015] p-3 text-xs">
              <span className="font-mono text-[10px] uppercase text-[#77736c]">Data & Persistence</span>
              <p className="mt-1 text-[#c8c4bc]">{arch.data_persistence}</p>
            </div>
          )}
        </div>
      </section>

      {/* 03 & 04: ARCHITECTURAL STRENGTHS & CONCERNS */}
      <section className="space-y-3 border-t border-white/[.06] pt-5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* Architectural Strengths */}
          <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[.03] p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <CheckCircle2 size={13} />
              <span>Architectural Strengths</span>
            </div>
            <ul className="space-y-2 text-xs leading-5 text-[#c8c4bc]">
              {strengths.length > 0 ? (
                strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400 shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))
              ) : (
                <li className="text-[#77736c]">Initial modular structure identified.</li>
              )}
            </ul>
          </div>

          {/* Architectural Concerns */}
          <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/[.03] p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <AlertTriangle size={13} />
              <span>Architectural Concerns</span>
            </div>
            <ul className="space-y-2 text-xs leading-5 text-[#c8c4bc]">
              {concerns.length > 0 ? (
                concerns.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-400 shrink-0">•</span>
                    <span>{c}</span>
                  </li>
                ))
              ) : (
                <li className="text-[#77736c]">
                  No severe architectural bottlenecks detected. Maintain modular boundaries as features expand.
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* 05 / ANALYSIS LIMITATIONS */}
      <section className="space-y-2.5 border-t border-white/[.06] pt-5">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.16em] text-[#77736c]">
          <HelpCircle size={12} />
          <span>05 / Analysis Limitations & Coverage Boundaries</span>
        </div>
        <ul className="space-y-1.5 text-[11px] leading-4 text-[#77736c]">
          {limitations.map((lim, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[#55514b]">•</span>
              <span>{lim}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
