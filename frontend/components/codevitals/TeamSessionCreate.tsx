'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Sparkles,
  Shield,
  Layers,
  HelpCircle,
} from 'lucide-react'
import type { Analysis, AssessableComponent } from '@/lib/api'
import { getAssessableComponents, createTeamSession } from '@/lib/api'
import { Select } from '@/components/ui/Select'

interface TeamSessionCreateProps {
  analysis: Analysis | null
  onBack: () => void
  onCreated: (teamData: { id: string; organizer_token: string; invite_token: string }) => void
}

interface MemberFormSlot {
  id: string
  display_name: string
  assigned_role: string
  assigned_components: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  question_count: number
}

export function TeamSessionCreate({ analysis, onBack, onCreated }: TeamSessionCreateProps) {
  const [teamName, setTeamName] = useState('')
  const [description, setDescription] = useState('')
  const [isHackathonMode, setIsHackathonMode] = useState(true)

  // Hackathon context
  const [problemStatement, setProblemStatement] = useState('')
  const [targetUsers, setTargetUsers] = useState('')
  const [demoWorkflow, setDemoWorkflow] = useState('')

  const [components, setComponents] = useState<AssessableComponent[]>([])
  const [members, setMembers] = useState<MemberFormSlot[]>([
    {
      id: '1',
      display_name: 'Frontend Lead',
      assigned_role: 'Frontend Engineer',
      assigned_components: ['comp-frontend-pages'],
      difficulty: 'intermediate',
      question_count: 10,
    },
    {
      id: '2',
      display_name: 'Backend Lead',
      assigned_role: 'Backend Architect',
      assigned_components: ['comp-api-routes'],
      difficulty: 'intermediate',
      question_count: 10,
    },
    {
      id: '3',
      display_name: 'Full Stack',
      assigned_role: 'Full Stack Engineer',
      assigned_components: ['complete'],
      difficulty: 'intermediate',
      question_count: 10,
    },
  ])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!analysis?.id) return
    getAssessableComponents(analysis.id)
      .then(res => {
        setComponents(res)
        // If components found, map default member slots sensibly
        if (res.length > 0) {
          const feComp = res.find(c => c.layer === 'presentation')?.id || res[0].id
          const beComp = res.find(c => c.layer === 'api' || c.layer === 'domain')?.id || res[0].id
          setMembers([
            {
              id: '1',
              display_name: 'Frontend Lead',
              assigned_role: 'Frontend Engineer',
              assigned_components: [feComp],
              difficulty: 'intermediate',
              question_count: 10,
            },
            {
              id: '2',
              display_name: 'Backend Lead',
              assigned_role: 'Backend Architect',
              assigned_components: [beComp],
              difficulty: 'intermediate',
              question_count: 10,
            },
            {
              id: '3',
              display_name: 'Integration & Testing',
              assigned_role: 'General Engineer',
              assigned_components: ['complete'],
              difficulty: 'intermediate',
              question_count: 10,
            },
          ])
        }
      })
      .catch(() => {})
  }, [analysis?.id])

  const addMember = () => {
    const newId = String(Date.now())
    setMembers(prev => [
      ...prev,
      {
        id: newId,
        display_name: `Teammate ${prev.length + 1}`,
        assigned_role: 'Developer',
        assigned_components: ['complete'],
        difficulty: 'intermediate',
        question_count: 10,
      },
    ])
  }

  const removeMember = (id: string) => {
    if (members.length <= 1) return
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  const updateMember = (id: string, field: keyof MemberFormSlot, value: any) => {
    setMembers(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!analysis?.id) return
    if (!teamName.trim()) {
      setError('Please provide a team name.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const payload = {
        analysis_id: analysis.id,
        team_name: teamName.trim(),
        description: description.trim() || undefined,
        is_hackathon_mode: isHackathonMode,
        hackathon_context: isHackathonMode
          ? {
              problem_statement: problemStatement.trim() || undefined,
              target_users: targetUsers.trim() || undefined,
              demo_workflow: demoWorkflow.trim() || undefined,
            }
          : undefined,
        members: members.map(m => ({
          display_name: m.display_name.trim() || 'Teammate',
          assigned_role: m.assigned_role.trim() || undefined,
          assigned_components: m.assigned_components.length > 0 ? m.assigned_components : ['complete'],
          difficulty: m.difficulty,
          question_count: m.question_count,
        })),
      }

      const res = await createTeamSession(payload)
      onCreated({
        id: res.id,
        organizer_token: res.organizer_token,
        invite_token: res.invite_token,
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to create team session.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-4xl mx-auto p-5 sm:p-7 reveal space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/[.08] pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[#8e8a82] hover:text-white transition"
        >
          <ArrowLeft size={14} />
          <span>Back to Options</span>
        </button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-purple-400 font-bold">
          Step 2 / Team Setup
        </span>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Users size={20} className="text-purple-400" />
          <h2 className="text-xl font-bold text-white">Create Team Assessment Session</h2>
        </div>
        <p className="mt-1 text-xs text-[#aaa69e]">
          Set up team member responsibilities, shared architecture questions, and generate a shareable invitation link.
        </p>
      </div>

      {error && (
        <div className="border border-rose-400/20 bg-rose-400/[.05] p-3 text-xs text-rose-300 rounded">
          {error}
        </div>
      )}

      {/* 1. BASIC TEAM INFO */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
            Team / Project Name *
          </label>
          <input
            type="text"
            required
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="e.g. SmartCampus Hackers, Team Alpha"
            className="w-full rounded-lg border border-white/[.12] bg-black/40 px-3 py-2 text-xs text-white placeholder:text-[#55514b] focus:border-purple-400 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
            Session Goal / Note (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Prep for Round 2 Pitch, Viva Assessment"
            className="w-full rounded-lg border border-white/[.12] bg-black/40 px-3 py-2 text-xs text-white placeholder:text-[#55514b] focus:border-purple-400 focus:outline-none"
          />
        </div>
      </div>

      {/* 2. HACKATHON READINESS MODE TOGGLE & CONTEXT */}
      <div className="rounded-xl border border-purple-400/30 bg-purple-400/[.04] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <div>
              <div className="text-xs font-bold text-white">Enable Hackathon Readiness Mode</div>
              <div className="text-[11px] text-[#aaa69e]">
                Prepares teammates for technical judge Q&A, mock demo contingencies, and architectural defense.
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isHackathonMode}
              onChange={e => setIsHackathonMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-black/60 border border-white/[.15] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
          </label>
        </div>

        {isHackathonMode && (
          <div className="space-y-3 border-t border-purple-400/20 pt-3 text-xs">
            <div className="font-mono text-[10px] uppercase tracking-wider text-purple-300 font-semibold">
              Optional Hackathon Project Context (Clearly distinguished from repository AST evidence)
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] text-[#8e8a82] mb-1">Problem Statement</label>
                <textarea
                  rows={2}
                  value={problemStatement}
                  onChange={e => setProblemStatement(e.target.value)}
                  placeholder="e.g. Automates medical repo audits for open-source teams..."
                  className="w-full rounded-lg border border-white/[.1] bg-black/40 p-2 text-xs text-white placeholder:text-[#55514b] focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8e8a82] mb-1">Planned Demo Workflow</label>
                <textarea
                  rows={2}
                  value={demoWorkflow}
                  onChange={e => setDemoWorkflow(e.target.value)}
                  placeholder="e.g. 1. Paste repo URL → 2. View 3D Anatomy → 3. Run CodeVitals..."
                  className="w-full rounded-lg border border-white/[.1] bg-black/40 p-2 text-xs text-white placeholder:text-[#55514b] focus:border-purple-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. TEAM RESPONSIBILITIES & COMPONENT ASSIGNMENTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[#8e8a82]">
              3. Teammate Responsibilities & Scopes ({members.length} members)
            </label>
            <p className="text-[11px] text-[#77736c]">
              Each teammate receives 70% component-assigned questions + 30% shared team architecture questions.
            </p>
          </div>
          <button
            type="button"
            onClick={addMember}
            className="flex items-center gap-1 rounded border border-white/[.1] bg-white/[.04] px-2.5 py-1 text-xs text-[#c8c4bc] hover:bg-white/[.08] hover:text-white"
          >
            <Plus size={13} />
            <span>Add Member</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {members.map((m, idx) => (
            <div
              key={m.id}
              className="card p-3 border-white/[.08] bg-black/30 grid gap-3 sm:grid-cols-4 items-center"
            >
              <div>
                <span className="font-mono text-[9px] uppercase text-[#77736c] block mb-1">
                  Name / Identifier
                </span>
                <input
                  type="text"
                  value={m.display_name}
                  onChange={e => updateMember(m.id, 'display_name', e.target.value)}
                  className="w-full rounded border border-white/[.1] bg-black/40 px-2 py-1 text-xs text-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <span className="font-mono text-[9px] uppercase text-[#77736c] block mb-1">
                  Assigned Role
                </span>
                <input
                  type="text"
                  value={m.assigned_role}
                  onChange={e => updateMember(m.id, 'assigned_role', e.target.value)}
                  placeholder="e.g. Frontend"
                  className="w-full rounded border border-white/[.1] bg-black/40 px-2 py-1 text-xs text-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <span className="font-mono text-[9px] uppercase text-[#77736c] block mb-1">
                  Assigned Scope
                </span>
                <Select
                  value={m.assigned_components[0] || 'complete'}
                  onChange={val => updateMember(m.id, 'assigned_components', [val])}
                  accentColor="purple"
                  ariaLabel={`Assigned Scope for ${m.display_name}`}
                  options={[
                    { value: 'complete', label: 'Complete Codebase' },
                    ...components.map(c => ({
                      value: c.id,
                      label: c.name,
                      badge: `${c.file_count} files`,
                    })),
                  ]}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <span className="font-mono text-[9px] uppercase text-[#77736c] block mb-1">
                    Difficulty
                  </span>
                  <Select
                    value={m.difficulty}
                    onChange={val => updateMember(m.id, 'difficulty', val as 'beginner' | 'intermediate' | 'advanced')}
                    accentColor="purple"
                    ariaLabel={`Difficulty for ${m.display_name}`}
                    options={[
                      { value: 'beginner', label: 'Beginner' },
                      { value: 'intermediate', label: 'Intermediate' },
                      { value: 'advanced', label: 'Advanced' },
                    ]}
                  />
                </div>

                {members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="mt-4 rounded p-1.5 text-[#77736c] hover:bg-rose-500/10 hover:text-rose-400"
                    title="Remove Member Slot"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMIT BUTTON */}
      <div className="border-t border-white/[.08] pt-4 flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#8e8a82]">
          Generates a shareable cryptographic link for teammates
        </span>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-purple-400/40 bg-purple-400 px-6 py-2.5 text-xs font-bold text-black transition hover:bg-purple-300 disabled:opacity-50"
        >
          <span>{loading ? 'Creating Team Session…' : 'Create Team Session & Get Share Link'}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </form>
  )
}

