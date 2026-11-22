'use client'

import React, { useState, useEffect } from 'react'
import {
  Layers,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  Square,
  AlertTriangle,
  FolderCode,
  Radio,
  Cpu,
  Database,
  Shield,
  Share2,
  Box,
  CheckCircle2,
} from 'lucide-react'
import type { Analysis, AssessableComponent } from '@/lib/api'
import { getAssessableComponents } from '@/lib/api'

interface ComponentAssessmentConfigProps {
  analysis: Analysis | null
  onBack: () => void
  onStart: (config: {
    selectedComponents: string[]
    questionCount: number
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    participantName?: string
  }) => void
  loading: boolean
}

export function ComponentAssessmentConfig({
  analysis,
  onBack,
  onStart,
  loading,
}: ComponentAssessmentConfigProps) {
  const [components, setComponents] = useState<AssessableComponent[]>([])
  const [fetchingComps, setFetchingComps] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState<number>(10)
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [participantName, setParticipantName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!analysis?.id) return
    getAssessableComponents(analysis.id)
      .then(res => {
        setComponents(res)
        // Default select first 2 components if available
        if (res.length > 0) {
          setSelectedIds([res[0].id])
        }
      })
      .catch(e => setError(e.message || 'Failed to load components'))
      .finally(() => setFetchingComps(false))
  }, [analysis?.id])

  const toggleComponent = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedIds(components.map(c => c.id))
  }

  const clearAll = () => {
    setSelectedIds([])
  }

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case 'presentation':
        return <Layers size={14} className="text-amber-400" />
      case 'api':
        return <Radio size={14} className="text-sky-400" />
      case 'domain':
        return <Cpu size={14} className="text-indigo-400" />
      case 'data':
        return <Database size={14} className="text-emerald-400" />
      case 'security':
        return <Shield size={14} className="text-rose-400" />
      case 'integration':
        return <Share2 size={14} className="text-purple-400" />
      case 'infrastructure':
        return <Box size={14} className="text-orange-400" />
      default:
        return <FolderCode size={14} className="text-slate-400" />
    }
  }

  return (
    <div className="card max-w-4xl mx-auto p-5 sm:p-7 reveal space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/[.08] pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[#8e8a82] hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Options</span>
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-sky-400 font-bold">
          Step 2 / Component Selection
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Layers size={20} className="text-sky-400" />
          <h2 className="text-xl font-bold text-white">Component Assessment</h2>
        </div>
        <p className="mt-1 text-xs text-[#aaa69e]">
          Choose one or multiple specific subsystems to test your deep technical understanding.
        </p>
      </div>

      {error && (
        <div className="border border-rose-400/20 bg-rose-400/[.05] p-3 text-xs text-rose-300 rounded">
          {error}
        </div>
      )}

      {/* 1. COMPONENT SELECTION MATRIX */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
            1. Select Subsystems ({selectedIds.length} of {components.length} chosen)
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-[11px] font-mono text-sky-400 hover:underline"
            >
              Select All
            </button>
            <span className="text-[#55514b]">|</span>
            <button
              onClick={clearAll}
              className="text-[11px] font-mono text-[#8e8a82] hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>

        {fetchingComps ? (
          <div className="p-8 text-center text-xs text-[#77736c]">
            Discovering assessable components from repository anatomy…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {components.map(comp => {
              const isSelected = selectedIds.includes(comp.id)
              return (
                <div
                  key={comp.id}
                  onClick={() => toggleComponent(comp.id)}
                  className={`card relative p-4 border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-sky-400 bg-sky-400/[.06] ring-1 ring-sky-400/40'
                      : 'border-white/[.1] hover:border-white/[.25]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        {getLayerIcon(comp.layer)}
                        <span className="font-bold text-white text-xs truncate">{comp.name}</span>
                      </div>
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'border-sky-400 bg-sky-400 text-black'
                            : 'border-white/[.2] bg-black/40'
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] text-[#aaa69e] line-clamp-2 leading-relaxed">
                      {comp.role}
                    </p>

                    <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[#77736c] border-t border-white/[.06] pt-2">
                      <span>{comp.file_count} files</span>
                      <span>{comp.total_lines?.toLocaleString()} lines</span>
                    </div>

                    {comp.technologies && comp.technologies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {comp.technologies.slice(0, 3).map(t => (
                          <span
                            key={t}
                            className="rounded bg-white/[.04] px-1.5 py-0.2 font-mono text-[9px] text-[#8e8a82]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. LENGTH & DIFFICULTY */}
      <div className="grid gap-4 sm:grid-cols-2 border-t border-white/[.08] pt-4">
        <div className="space-y-2">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
            2. Number of Questions
          </label>
          <div className="flex items-center gap-2">
            {[10, 20, 30].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => setQuestionCount(cnt)}
                className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
                  questionCount === cnt
                    ? 'border-sky-400 bg-sky-400 text-black'
                    : 'border-white/[.1] bg-black/40 text-[#aaa69e] hover:bg-white/[.04]'
                }`}
              >
                {cnt} Questions
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
            3. Difficulty
          </label>
          <div className="flex items-center gap-2">
            {(['beginner', 'intermediate', 'advanced'] as const).map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => setDifficulty(lvl)}
                className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition ${
                  difficulty === lvl
                    ? 'border-sky-400 bg-sky-400 text-black'
                    : 'border-white/[.1] bg-black/40 text-[#aaa69e] hover:bg-white/[.04]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. OPTIONAL PARTICIPANT NAME */}
      <div className="space-y-2">
        <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
          4. Your Name (Optional)
        </label>
        <input
          type="text"
          value={participantName}
          onChange={e => setParticipantName(e.target.value)}
          placeholder="e.g. Jordan"
          className="w-full sm:w-72 rounded-lg border border-white/[.12] bg-black/40 px-3 py-2 text-xs text-white placeholder:text-[#55514b] focus:border-sky-400 focus:outline-none"
        />
      </div>

      {/* REVIEW SUMMARY & START ACTION */}
      <div className="border-t border-white/[.08] pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="font-mono text-[10px] text-[#8e8a82]">
          Selected: <strong className="text-white">{selectedIds.length} component(s)</strong> · Target: <strong className="text-white">{questionCount} Qs</strong>
        </div>

        <button
          onClick={() => {
            if (selectedIds.length === 0) {
              alert('Please select at least one component to assess.')
              return
            }
            onStart({
              selectedComponents: selectedIds,
              questionCount,
              difficulty,
              participantName: participantName.trim() || undefined,
            })
          }}
          disabled={loading || selectedIds.length === 0}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400 px-6 py-2.5 text-xs font-bold text-black transition hover:bg-sky-300 disabled:opacity-50"
        >
          <span>{loading ? 'Generating Component Assessment…' : 'Start Component Assessment'}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

