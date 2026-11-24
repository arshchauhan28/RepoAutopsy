'use client'

import React, { useState } from 'react'
import { Compass, ArrowLeft, ArrowRight, ShieldCheck, Check, Sparkles } from 'lucide-react'
import type { Analysis } from '@/lib/api'

interface CompleteAssessmentConfigProps {
  analysis: Analysis | null
  onBack: () => void
  onStart: (config: {
    questionCount: number
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    participantName?: string
  }) => void
  loading: boolean
}

export function CompleteAssessmentConfig({
  analysis,
  onBack,
  onStart,
  loading,
}: CompleteAssessmentConfigProps) {
  const [questionCount, setQuestionCount] = useState<number>(10)
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [participantName, setParticipantName] = useState('')

  const lengthOptions = [
    {
      count: 10,
      title: 'Quick Checkup',
      subtitle: '~10 questions',
      desc: 'Concise evaluation covering primary architecture, core workflow, and key technologies.',
    },
    {
      count: 20,
      title: 'Standard Examination',
      subtitle: '~20 questions',
      desc: 'Balanced assessment testing subsystems, inter-module dependencies, and error handling.',
      recommended: true,
    },
    {
      count: 30,
      title: 'Comprehensive Examination',
      subtitle: '~30 questions',
      desc: 'In-depth evaluation probing security, performance tradeoffs, and failure modes.',
    },
  ]

  const difficultyOptions: { id: 'beginner' | 'intermediate' | 'advanced'; label: string; desc: string }[] = [
    {
      id: 'beginner',
      label: 'Beginner',
      desc: 'Focuses on subsystem responsibilities, framework identification, and high-level flow.',
    },
    {
      id: 'intermediate',
      label: 'Intermediate',
      desc: 'Evaluates concrete file roles, inter-component links, and data transformation.',
    },
    {
      id: 'advanced',
      label: 'Advanced',
      desc: 'Deep questions on security vulnerabilities, circular cycles, and failure contingencies.',
    },
  ]

  return (
    <div className="card max-w-3xl mx-auto p-5 sm:p-7 reveal space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/[.08] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[#8e8a82] hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Options</span>
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400 font-bold">
          Step 2 / Configuration
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Compass size={20} className="text-amber-400" />
          <h2 className="text-xl font-bold text-white">Complete Codebase Assessment</h2>
        </div>
        <p className="mt-1 text-xs text-[#aaa69e]">
          Configure your assessment parameters for {analysis?.owner}/{analysis?.repo_name}.
        </p>
      </div>

      {/* 1. ASSESSMENT LENGTH */}
      <div className="space-y-3">
        <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
          1. Assessment Length
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {lengthOptions.map(opt => (
            <div
              key={opt.count}
              onClick={() => setQuestionCount(opt.count)}
              className={`relative card p-4 border transition cursor-pointer flex flex-col justify-between ${
                questionCount === opt.count
                  ? 'border-amber-400 bg-amber-400/[.06] ring-1 ring-amber-400/40'
                  : 'border-white/[.1] hover:border-white/[.25]'
              }`}
            >
              {opt.recommended && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-amber-400 px-2 py-0.2 font-mono text-[8px] font-bold uppercase text-black">
                  Recommended
                </span>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{opt.title}</span>
                  {questionCount === opt.count && <Check size={14} className="text-amber-400" />}
                </div>
                <div className="font-mono text-[11px] text-amber-300/90 mt-0.5">{opt.subtitle}</div>
                <p className="mt-2 text-[11px] text-[#8e8a82] leading-relaxed">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. DIFFICULTY LEVEL */}
      <div className="space-y-3">
        <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
          2. Difficulty Level
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {difficultyOptions.map(opt => (
            <div
              key={opt.id}
              onClick={() => setDifficulty(opt.id)}
              className={`card p-3.5 border transition cursor-pointer ${
                difficulty === opt.id
                  ? 'border-amber-400 bg-amber-400/[.06] ring-1 ring-amber-400/40'
                  : 'border-white/[.1] hover:border-white/[.25]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{opt.label}</span>
                {difficulty === opt.id && <Check size={13} className="text-amber-400" />}
              </div>
              <p className="mt-1.5 text-[11px] text-[#8e8a82] leading-relaxed">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. OPTIONAL PARTICIPANT NAME */}
      <div className="space-y-2">
        <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
          3. Your Name (Optional)
        </label>
        <input
          type="text"
          value={participantName}
          onChange={e => setParticipantName(e.target.value)}
          placeholder="e.g. Alex"
          className="w-full sm:w-72 rounded-lg border border-white/[.12] bg-black/40 px-3 py-2 text-xs text-white placeholder:text-[#55514b] focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* METHODOLOGY TRANSPARENCY NOTICE */}
      <div className="rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-[11px] text-[#8e8a82] leading-relaxed">
        <span className="text-white font-medium">Evaluation Transparency:</span> CodeVitals generates questions using repository analysis and source evidence. Automated validation reduces unsupported questions, but generated content may still contain inaccuracies.
      </div>

      {/* REVIEW SUMMARY & START ACTION */}
      <div className="border-t border-white/[.08] pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="font-mono text-[10px] text-[#8e8a82]">
          Scope: <strong className="text-white">Entire Codebase</strong> · Target: <strong className="text-white">{questionCount} Qs</strong> ({difficulty})
        </div>

        <button
          onClick={() =>
            onStart({
              questionCount,
              difficulty,
              participantName: participantName.trim() || undefined,
            })
          }
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400 px-6 py-2.5 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
        >
          <span>{loading ? 'Generating Assessment…' : 'Start Complete Assessment'}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

