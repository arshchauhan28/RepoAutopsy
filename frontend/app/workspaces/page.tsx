'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, ArrowRight, Users, FolderGit2, Shield, Loader2, X, Check } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { getWorkspaces, createWorkspace, joinWorkspace, type Workspace } from '@/lib/api'

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Join by token
  const [inviteToken, setInviteToken] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getWorkspaces()
      setWorkspaces(data)
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Unable to load workspaces. Please make sure you are signed in.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      const created = await createWorkspace({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
        workspace_type: 'team',
      })
      setWorkspaces((prev) => [...prev, created])
      setIsCreateOpen(false)
      setCreateName('')
      setCreateDesc('')
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create workspace.')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanToken = inviteToken.trim().split('/').pop() || ''
    if (!cleanToken) return
    setJoinLoading(true)
    setJoinError(null)
    try {
      const joined = await joinWorkspace(cleanToken)
      setWorkspaces((prev) => {
        if (prev.some((w) => w.id === joined.id)) return prev
        return [...prev, joined]
      })
      setInviteToken('')
      alert(`Successfully joined ${joined.name}!`)
    } catch (err: any) {
      setJoinError(err?.message || 'Invalid or expired invitation token.')
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[.08] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-amber-400" />
              <h1 className="text-2xl font-semibold tracking-tight text-white">Workspaces</h1>
            </div>
            <p className="mt-1 text-xs text-[#aaa69e]">
              Manage collaborative team workspaces, share repository analysis history, and configure pull request automation.
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-300"
          >
            <Plus size={14} />
            <span>New Team Workspace</span>
          </button>
        </div>

        {/* JOIN WORKSPACE BOX */}
        <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-white">Have an invitation token?</div>
            <div className="text-[11px] text-[#77736c]">Enter your shareable invite token or URL to join an existing team.</div>
          </div>
          <form onSubmit={handleJoin} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="Paste invite token or link"
              className="rounded border border-white/[.12] bg-[#0c0f13] px-3 py-1.5 text-xs text-white placeholder-[#55514b] focus:border-amber-400/60 focus:outline-none w-full sm:w-64 font-mono text-[11px]"
            />
            <button
              type="submit"
              disabled={joinLoading || !inviteToken.trim()}
              className="rounded border border-white/[.15] bg-white/[.04] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/[.08] disabled:opacity-40 shrink-0"
            >
              {joinLoading ? 'Joining…' : 'Join'}
            </button>
          </form>
          {joinError && <p className="text-xs text-rose-400 w-full sm:col-span-2">{joinError}</p>}
        </div>

        {/* WORKSPACES GRID */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-amber-400" />
            <p className="mt-3 text-xs text-[#77736c]">Loading workspaces…</p>
          </div>
        ) : error ? (
          <div className="card border-rose-500/20 bg-rose-500/[.03] p-6 text-center text-xs text-rose-300">
            {error}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="card p-12 text-center text-xs text-[#aaa69e] space-y-3">
            <Building2 size={32} className="mx-auto text-[#77736c]" />
            <p className="text-sm font-semibold text-white">No workspaces found</p>
            <p className="max-w-md mx-auto text-[#77736c]">
              Create a team workspace to invite teammates, share private codebase reports, and automate PR autopsies.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
            >
              <Plus size={14} /> Create First Workspace
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="card p-5 flex flex-col justify-between hover:border-white/20 transition group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white group-hover:text-amber-300 transition">
                      {ws.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase font-bold ${
                        ws.current_user_role === 'owner'
                          ? 'bg-amber-400/20 text-amber-300'
                          : ws.current_user_role === 'admin'
                          ? 'bg-indigo-400/20 text-indigo-300'
                          : 'bg-white/[.08] text-[#aaa69e]'
                      }`}
                    >
                      {ws.current_user_role}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-[#aaa69e] line-clamp-2 leading-relaxed">
                    {ws.description || 'Collaborative developer workspace'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[.06] flex items-center justify-between text-xs font-mono text-[#77736c]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {ws.member_count} member{ws.member_count === 1 ? '' : 's'}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <FolderGit2 size={12} /> {ws.repository_count} repo{ws.repository_count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ArrowRight size={14} className="text-[#77736c] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CREATE WORKSPACE MODAL */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="card w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[.08] pb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-amber-400" />
                  <h3 className="font-semibold text-sm text-white">Create Team Workspace</h3>
                </div>
                <button onClick={() => setIsCreateOpen(false)} className="text-[#77736c] hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-mono text-[#aaa69e] mb-1">Workspace Name *</label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Core Engineering, Hackathon Alpha"
                    className="w-full rounded border border-white/[.12] bg-[#0c0f13] px-3 py-2 text-white placeholder-[#55514b] focus:border-amber-400/60 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#aaa69e] mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    placeholder="Team purpose and codebase focus"
                    className="w-full rounded border border-white/[.12] bg-[#0c0f13] px-3 py-2 text-white placeholder-[#55514b] focus:border-amber-400/60 focus:outline-none text-xs"
                  />
                </div>

                {createError && <p className="text-xs text-rose-400">{createError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded border border-white/[.1] px-4 py-2 text-xs text-[#aaa69e] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading || !createName.trim()}
                    className="rounded border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
                  >
                    {createLoading ? 'Creating…' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
