'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  FolderGit2,
  Users,
  Settings,
  Plus,
  GitPullRequest,
  Check,
  Copy,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Loader2,
  X,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import {
  getWorkspace,
  updateWorkspace,
  getWorkspaceMembers,
  createWorkspaceInvitation,
  changeMemberRole,
  removeWorkspaceMember,
  getWorkspaceRepositories,
  connectWorkspaceRepository,
  disconnectWorkspaceRepository,
  updateRepoAutomation,
  type Workspace,
  type WorkspaceMember,
  type ConnectedRepository,
  type AutomationSettings,
} from '@/lib/api'

export default function WorkspaceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const workspaceId = params.id

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [repositories, setRepositories] = useState<ConnectedRepository[]>([])
  const [activeTab, setActiveTab] = useState<'repositories' | 'members' | 'settings'>('repositories')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Connect Repo Modal
  const [isConnectOpen, setIsConnectOpen] = useState(false)
  const [connectUrl, setConnectUrl] = useState('')
  const [connectBranch, setConnectBranch] = useState('main')
  const [connectPrivate, setConnectPrivate] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Invite Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Settings form
  const [nameInput, setNameInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [ws, mems, repos] = await Promise.all([
        getWorkspace(workspaceId),
        getWorkspaceMembers(workspaceId),
        getWorkspaceRepositories(workspaceId),
      ])
      setWorkspace(ws)
      setMembers(mems)
      setRepositories(repos)
      setNameInput(ws.name)
      setDescInput(ws.description || '')
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to load workspace.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [workspaceId])

  const handleConnectRepo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connectUrl.trim()) return
    setConnectLoading(true)
    setConnectError(null)
    try {
      const created = await connectWorkspaceRepository(workspaceId, {
        github_url: connectUrl.trim(),
        default_branch: connectBranch.trim() || 'main',
        is_private: connectPrivate,
      })
      setRepositories((prev) => [...prev, created])
      setIsConnectOpen(false)
      setConnectUrl('')
      setConnectBranch('main')
      setConnectPrivate(false)
    } catch (err: any) {
      setConnectError(err?.message || 'Failed to connect repository.')
    } finally {
      setConnectLoading(false)
    }
  }

  const handleDisconnectRepo = async (repoId: string) => {
    if (!confirm('Are you sure you want to disconnect this repository from the workspace?')) return
    try {
      await disconnectWorkspaceRepository(workspaceId, repoId)
      setRepositories((prev) => prev.filter((r) => r.id !== repoId))
    } catch (err: any) {
      alert(err?.message || 'Failed to disconnect repository.')
    }
  }

  const handleToggleAutomation = async (repo: ConnectedRepository, enabled: boolean) => {
    try {
      const updated = await updateRepoAutomation(workspaceId, repo.id, { is_enabled: enabled })
      setRepositories((prev) =>
        prev.map((r) => (r.id === repo.id ? { ...r, automation_settings: updated } : r))
      )
    } catch (err: any) {
      alert(err?.message || 'Failed to update automation.')
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError(null)
    try {
      const res = await createWorkspaceInvitation(workspaceId, {
        role: inviteRole,
        target_email: inviteEmail.trim() || undefined,
        target_github_username: inviteUsername.trim() || undefined,
        expires_in_days: 7,
      })
      setGeneratedInviteUrl(res.invite_url)
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to generate invitation.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopyInvite = () => {
    if (!generatedInviteUrl) return
    navigator.clipboard.writeText(generatedInviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const updated = await changeMemberRole(workspaceId, userId, newRole)
      setMembers((prev) => prev.map((m) => (m.user_id === userId ? updated : m)))
    } catch (err: any) {
      alert(err?.message || 'Failed to change role.')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    try {
      await removeWorkspaceMember(workspaceId, userId)
      setMembers((prev) => prev.filter((m) => m.user_id !== userId))
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member.')
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveLoading(true)
    setSaveSuccess(false)
    try {
      const updated = await updateWorkspace(workspaceId, {
        name: nameInput.trim(),
        description: descInput.trim() || undefined,
      })
      setWorkspace(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      alert(err?.message || 'Failed to update settings.')
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="h-6 w-48 rounded bg-white/[.06] animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </div>
    )
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
          <ErrorState
            title="Workspace Not Found"
            message={error || 'Unable to load workspace details or you may not have access.'}
            onRetry={loadData}
          />
        </main>
      </div>
    )
  }

  const canManage = workspace.current_user_role === 'owner' || workspace.current_user_role === 'admin'

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Workspaces', href: '/workspaces' },
    { label: workspace.name },
  ]

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <Breadcrumbs items={breadcrumbs} />

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[.08] pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Building2 size={20} className="text-amber-400" />
              <h1 className="text-2xl font-semibold text-white">{workspace.name}</h1>
              <Badge variant={workspace.current_user_role === 'owner' ? 'accent' : 'warning'}>
                {workspace.current_user_role}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-[#9ca3af]">{workspace.description || 'Collaborative team workspace'}</p>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button
                  onClick={() => setIsInviteOpen(true)}
                  variant="secondary"
                  size="sm"
                  leftIcon={<Users size={13} />}
                >
                  Invite Teammate
                </Button>

                <Button
                  onClick={() => setIsConnectOpen(true)}
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={14} />}
                >
                  Connect Repo
                </Button>
              </>
            )}
          </div>
        </div>

        {/* WORKSPACE INTERNAL TABS */}
        <nav className="flex items-center gap-2 border-b border-white/[.08] pb-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('repositories')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition ${
              activeTab === 'repositories'
                ? 'border-amber-400 text-white font-bold'
                : 'border-transparent text-[#77736c] hover:text-white'
            }`}
          >
            <FolderGit2 size={13} />
            <span>Repositories ({repositories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition ${
              activeTab === 'members'
                ? 'border-amber-400 text-white font-bold'
                : 'border-transparent text-[#77736c] hover:text-white'
            }`}
          >
            <Users size={13} />
            <span>Members ({members.length})</span>
          </button>

          {canManage && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition ${
                activeTab === 'settings'
                  ? 'border-amber-400 text-white font-bold'
                  : 'border-transparent text-[#77736c] hover:text-white'
              }`}
            >
              <Settings size={13} />
              <span>Settings</span>
            </button>
          )}
        </nav>

        {/* TAB 1: REPOSITORIES */}
        {activeTab === 'repositories' && (
          <div className="space-y-4">
            {repositories.length === 0 ? (
              <div className="card p-12 text-center text-xs text-[#aaa69e] space-y-3">
                <FolderGit2 size={32} className="mx-auto text-[#77736c]" />
                <p className="text-sm font-semibold text-white">No repositories connected</p>
                <p className="max-w-md mx-auto text-[#77736c]">
                  Connect GitHub repositories to this workspace to share analysis history, CodeVitals assessments, and enable automated PR autopsy.
                </p>
                {canManage && (
                  <button
                    onClick={() => setIsConnectOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300"
                  >
                    <Plus size={14} /> Connect Repository
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {repositories.map((repo) => (
                  <div key={repo.id} className="card p-5 space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm text-white">{repo.repo_name}</h3>
                          <p className="font-mono text-xs text-[#77736c]">{repo.owner}</p>
                        </div>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                          {repo.connection_status}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#aaa69e]">
                        <span>branch: <strong className="text-white">{repo.default_branch}</strong></span>
                        {repo.is_private && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">Private</span>}
                      </div>

                      {/* Automation Settings Card */}
                      <div className="mt-4 rounded-lg border border-white/[.08] bg-white/[.02] p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold text-white">
                            <GitPullRequest size={13} className="text-indigo-400" />
                            <span>Automated PR Autopsy</span>
                          </div>
                          {canManage && (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(repo.automation_settings?.is_enabled)}
                                onChange={(e) => handleToggleAutomation(repo, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-400"></div>
                            </label>
                          )}
                        </div>
                        <p className="text-[11px] text-[#77736c]">
                          {repo.automation_settings?.is_enabled
                            ? 'Enabled: New PRs automatically analyzed on open/update with webhook delivery.'
                            : 'Disabled: Enable to automatically run dependency and diagnostic autopsies on PRs.'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/[.06] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <a
                          href={repo.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-[#77736c] hover:text-white"
                        >
                          GitHub <ExternalLink size={10} />
                        </a>
                        <Link
                          href={`/analyze?url=${encodeURIComponent(repo.github_url)}`}
                          className="font-mono text-[11px] text-amber-300 hover:underline"
                        >
                          Analyze Snapshot →
                        </Link>
                      </div>

                      {canManage && (
                        <button
                          onClick={() => handleDisconnectRepo(repo.id)}
                          className="text-[#77736c] hover:text-rose-400 transition"
                          title="Disconnect repository"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MEMBERS */}
        {activeTab === 'members' && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[.08] bg-white/[.02] font-mono text-[10px] uppercase text-[#77736c]">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Joined</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[.04]">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[.01]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt={m.username} className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <div className="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-mono text-[10px] font-bold">
                              {m.username.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white">{m.display_name || m.username}</div>
                            <div className="font-mono text-[10px] text-[#77736c]">@{m.username}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono">
                        {canManage && m.role !== 'owner' ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                            className="rounded border border-white/[.12] bg-[#0c0f13] px-2 py-1 text-[11px] text-white focus:outline-none"
                          >
                            <option value="admin">admin</option>
                            <option value="member">member</option>
                            <option value="viewer">viewer</option>
                          </select>
                        ) : (
                          <span className="rounded bg-white/[.06] px-2 py-0.5 text-[10px] uppercase font-bold text-[#aaa69e]">
                            {m.role}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#77736c]">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>

                      {canManage && (
                        <td className="px-4 py-3.5 text-right">
                          {m.role !== 'owner' && (
                            <button
                              onClick={() => handleRemoveMember(m.user_id)}
                              className="text-[#77736c] hover:text-rose-400 transition"
                              title="Remove member"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && canManage && (
          <div className="card p-6 max-w-xl space-y-4">
            <h3 className="font-semibold text-sm text-white">Workspace Settings</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-[#aaa69e] mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded border border-white/[.12] bg-[#0c0f13] px-3 py-2 text-white focus:border-amber-400/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#aaa69e] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full rounded border border-white/[.12] bg-[#0c0f13] px-3 py-2 text-white focus:border-amber-400/60 focus:outline-none"
                />
              </div>

              {saveSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                  <Check size={13} />
                  <span>Settings updated successfully.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saveLoading}
                className="rounded border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
              >
                {saveLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}

        {/* CONNECT REPOSITORY MODAL */}
        <Dialog
          isOpen={isConnectOpen}
          onClose={() => setIsConnectOpen(false)}
          title="Connect Repository"
          description="Connect a GitHub repository to this workspace to enable automated PR analysis, shared intelligence, and team assessments."
        >
          <form onSubmit={handleConnectRepo} className="space-y-4">
            <Input
              label="GitHub Repository URL *"
              type="url"
              required
              value={connectUrl}
              onChange={(e) => setConnectUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              disabled={connectLoading}
            />

            <Input
              label="Default Branch"
              type="text"
              value={connectBranch}
              onChange={(e) => setConnectBranch(e.target.value)}
              placeholder="main"
              disabled={connectLoading}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPrivate"
                checked={connectPrivate}
                onChange={(e) => setConnectPrivate(e.target.checked)}
                className="rounded border-white/20 bg-[#0c0f13]"
              />
              <label htmlFor="isPrivate" className="text-xs text-[#c8c4bc]">
                This is a private repository
              </label>
            </div>

            {connectError && <p className="text-xs text-rose-400">{connectError}</p>}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/[.08]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsConnectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={connectLoading}
                disabled={!connectUrl.trim()}
              >
                Connect Repository
              </Button>
            </div>
          </form>
        </Dialog>

        {/* INVITE TEAMMATE MODAL */}
        <Dialog
          isOpen={isInviteOpen}
          onClose={() => {
            setIsInviteOpen(false)
            setGeneratedInviteUrl(null)
          }}
          title="Invite Teammate"
          description="Generate a shareable invitation token to add an engineering teammate to this workspace."
        >
          {generatedInviteUrl ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                Shareable invitation created! Send this link to your teammate.
              </div>

              <div>
                <label className="block text-xs font-medium text-[#d1d5db] mb-1.5">Invite Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="w-full rounded-md border border-white/[.12] bg-[#0c0f13] px-3.5 py-2 text-white font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleCopyInvite}
                    leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-white/[.08]">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsInviteOpen(false)
                    setGeneratedInviteUrl(null)
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#d1d5db] mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-md border border-white/[.12] bg-[#0c0f13] px-3.5 py-2 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <option value="member">member (view repos, run analyses, take CodeVitals)</option>
                  <option value="admin">admin (manage repos, invite members, configure automation)</option>
                  <option value="viewer">viewer (read-only access)</option>
                </select>
              </div>

              <Input
                label="Target Email (Optional)"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                disabled={inviteLoading}
              />

              <Input
                label="Target GitHub Username (Optional)"
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="octocat"
                disabled={inviteLoading}
              />

              {inviteError && <p className="text-xs text-rose-400">{inviteError}</p>}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/[.08]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsInviteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={inviteLoading}
                >
                  Generate Invite Link
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      </main>
    </div>
  )
}
