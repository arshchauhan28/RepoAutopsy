'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, ArrowRight, Users, FolderGit2, Shield, Loader2, X, Check } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/Skeleton'
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

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Workspaces' },
  ]

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <Breadcrumbs items={breadcrumbs} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[.08] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Building2 size={20} className="text-amber-400" />
              <h1 className="text-2xl font-semibold tracking-tight text-white">Workspaces</h1>
            </div>
            <p className="mt-1 text-xs text-[#9ca3af]">
              Manage collaborative team workspaces, share repository analysis history, and configure pull request automation.
            </p>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} />}
          >
            New Team Workspace
          </Button>
        </div>

        {/* JOIN WORKSPACE BOX */}
        <div className="rounded-lg border border-white/[.08] bg-[#0d0f12] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-white">Have an invitation token?</div>
            <div className="text-xs text-[#9ca3af]">Enter your shareable invite token or URL to join an existing team.</div>
          </div>
          <form onSubmit={handleJoin} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder="Paste invite token or link"
              className="rounded-md border border-white/[.12] bg-[#0c0f13] px-3 py-2 text-xs text-white placeholder-[#6b7280] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 w-full sm:w-64 font-mono text-[11px]"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={joinLoading || !inviteToken.trim()}
              isLoading={joinLoading}
            >
              Join
            </Button>
          </form>
          {joinError && <p className="text-xs text-rose-400 w-full sm:col-span-2">{joinError}</p>}
        </div>

        {/* WORKSPACES GRID */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/[.03] p-6 text-center text-xs text-rose-300">
            {error}
          </div>
        ) : workspaces.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} className="text-[#9ca3af]" />}
            title="No workspaces found"
            description="Create a team workspace to invite teammates, share private codebase reports, and automate PR autopsies."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                leftIcon={<Plus size={14} />}
              >
                Create First Workspace
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="rounded-lg border border-white/[.08] bg-[#0d0f12] p-5 flex flex-col justify-between hover:border-amber-400/40 transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white group-hover:text-amber-300 transition-colors">
                      {ws.name}
                    </span>
                    <Badge
                      variant={
                        ws.current_user_role === 'owner'
                          ? 'accent'
                          : ws.current_user_role === 'admin'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {ws.current_user_role || 'member'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[#9ca3af] line-clamp-2">
                    {ws.description || 'Collaborative team workspace'}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-white/[.06] flex items-center justify-between text-xs text-[#9ca3af]">
                  <span className="capitalize font-mono text-[10px]">{ws.workspace_type} Workspace</span>
                  <ArrowRight size={14} className="text-[#6b7280] group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CREATE WORKSPACE MODAL */}
        <Dialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Team Workspace"
          description="Workspaces allow your team to share codebase intelligence, review PR autopsies, and run collaborative assessments."
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Workspace Name *"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Core Engineering, Hackathon Alpha"
              disabled={createLoading}
            />

            <div>
              <label className="block text-xs font-medium text-[#d1d5db] mb-1.5">Description (Optional)</label>
              <textarea
                rows={3}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Team purpose and codebase focus"
                className="w-full rounded-md border border-white/[.12] bg-black/30 px-3.5 py-2 text-sm text-white placeholder-[#6b7280] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>

            {createError && <p className="text-xs text-rose-400">{createError}</p>}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/[.08]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={createLoading}
                disabled={!createName.trim()}
              >
                Create Workspace
              </Button>
            </div>
          </form>
        </Dialog>
      </main>
    </div>
  )
}
