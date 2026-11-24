'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  FolderGit2,
  GitPullRequest,
  BrainCircuit,
  Building2,
  Plus,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Layers,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { getDashboardSummary, type DashboardSummary } from '@/lib/api'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const summary = await getDashboardSummary()
      setData(summary)
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Unable to load dashboard. Please make sure you are signed in.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton variant="circular" className="h-12 w-12" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#08090b]">
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-white/[.1] bg-[#0d0f12] p-8 text-center space-y-4 shadow-xl">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-400/10 text-amber-400">
              <Building2 size={24} />
            </div>
            <h2 className="text-lg font-semibold text-white">Authentication Required</h2>
            <p className="text-xs text-[#9ca3af] leading-relaxed max-w-md mx-auto">
              {error || 'Sign in with your GitHub account to access persistent workspaces, connected repositories, and automated PR review dashboards.'}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link href="/analyze">
                <Button variant="secondary" size="md">
                  Continue as Guest
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const { user, metrics, workspaces, connected_repositories, recent_analyses, recent_pr_analyses, recent_assessments } = data

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* TOP GREETING & QUICK ACTIONS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[.08] pb-6">
          <div className="flex items-center gap-3.5">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="h-12 w-12 rounded-full border border-white/20 object-cover" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-400/20 text-amber-300 font-mono text-base font-bold">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Welcome back, {user.display_name || user.username}
              </h1>
              <p className="font-mono text-xs text-[#77736c]">
                GitHub: <span className="text-[#aaa69e]">@{user.username}</span>
                {user.email && <span> · {user.email}</span>}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <Link
              href="/analyze"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded border border-amber-400/40 bg-amber-400 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-300 w-full sm:w-auto"
            >
              <Plus size={14} />
              <span>Analyze Repository</span>
            </Link>

            <Link
              href="/workspaces"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded border border-white/[.15] bg-white/[.04] px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/[.08] w-full sm:w-auto"
            >
              <Building2 size={13} />
              <span>Workspaces</span>
            </Link>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="card p-3.5 sm:p-4">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">Repositories</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-white">{metrics.connected_repositories_count}</div>
            <div className="mt-1 text-[11px] text-[#77736c]">Connected in workspaces</div>
          </div>

          <div className="card p-3.5 sm:p-4">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">Analyses</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-white">{metrics.analyses_count}</div>
            <div className="mt-1 text-[11px] text-[#77736c]">Completed snapshot runs</div>
          </div>

          <div className="card p-3.5 sm:p-4">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">PR Reviews</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-indigo-400">{metrics.pr_analyses_count}</div>
            <div className="mt-1 text-[11px] text-[#77736c]">Impact autopsies</div>
          </div>

          <div className="card p-3.5 sm:p-4">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">Workspaces</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-amber-300">{metrics.workspaces_count}</div>
            <div className="mt-1 text-[11px] text-[#77736c]">Personal & team groups</div>
          </div>

          <div className="card p-3.5 sm:p-4 col-span-2 sm:col-span-1">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[#77736c]">CodeVitals</div>
            <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-emerald-400">{metrics.codevitals_sessions_count}</div>
            <div className="mt-1 text-[11px] text-[#77736c]">Completed assessments</div>
          </div>
        </div>

        {/* SECTION 1: CONNECTED REPOSITORIES */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 size={15} className="text-amber-400" />
              <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">Connected Repositories</h2>
            </div>
            <Link href="/workspaces" className="text-xs text-amber-400 hover:underline font-mono">
              Manage in Workspaces →
            </Link>
          </div>

          {connected_repositories.length === 0 ? (
            <div className="card p-6 text-center text-xs text-[#aaa69e] space-y-2">
              <p>No repositories connected yet.</p>
              <p className="text-[#77736c]">Connect your GitHub repositories to a workspace to enable automated PR analysis and shared intelligence.</p>
              <div className="pt-2">
                <Link
                  href="/workspaces"
                  className="inline-flex items-center gap-1.5 rounded border border-white/[.15] bg-white/[.04] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/[.08]"
                >
                  <Plus size={12} /> Connect First Repository
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {connected_repositories.map((repo) => (
                <div key={repo.id} className="card p-4 flex flex-col justify-between hover:border-white/20 transition">
                  <div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white truncate max-w-[150px]">{repo.repo_name}</span>
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                        {repo.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[#77736c] truncate">{repo.owner}</div>
                    <div className="mt-2 text-[11px] text-[#aaa69e]">branch: {repo.default_branch}</div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[.06] flex items-center justify-between text-xs">
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
                      Analyze →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: RECENT ANALYSES & RECENT PR REVIEWS (2 COLUMNS) */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Codebase Analyses */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-amber-400" />
                <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">Recent Snapshot Analyses</h2>
              </div>
              <Link href="/analyze" className="text-xs text-[#77736c] hover:text-white font-mono">New +</Link>
            </div>

            <div className="card divide-y divide-white/[.06] overflow-hidden">
              {recent_analyses.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#77736c]">No analyses recorded yet.</div>
              ) : (
                recent_analyses.map((a) => (
                  <Link
                    key={a.id}
                    href={`/repositories/${a.id}`}
                    className="flex items-center justify-between p-3.5 hover:bg-white/[.02] transition block"
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">
                        {a.owner}/{a.repo_name}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[#77736c]">
                        <span>{new Date(a.created_at).toLocaleDateString()}</span>
                        {a.metrics?.code_lines && (
                          <>
                            <span>·</span>
                            <span>{Number(a.metrics.code_lines).toLocaleString()} lines</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[10px] text-[#aaa69e]">
                        {a.status}
                      </span>
                      <ArrowRight size={13} className="text-[#77736c]" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent PR Reviews */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest size={15} className="text-indigo-400" />
                <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">Recent PR Autopsies</h2>
              </div>
            </div>

            <div className="card divide-y divide-white/[.06] overflow-hidden">
              {recent_pr_analyses.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#77736c]">No pull requests analyzed yet.</div>
              ) : (
                recent_pr_analyses.map((pr) => (
                  <div key={pr.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-indigo-300 font-semibold">#{pr.pr_number}</span>
                        <span className="font-medium text-xs text-white truncate max-w-[200px]">{pr.pr_title}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[#77736c]">
                        <span>{pr.repo_owner}/{pr.repo_name}</span>
                        <span>·</span>
                        <span className="text-emerald-400">+{pr.additions}</span>
                        <span className="text-rose-400">-{pr.deletions}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        pr.review_priority === 'high'
                          ? 'bg-rose-500/20 text-rose-300'
                          : pr.review_priority === 'medium'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {pr.review_priority.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: CODEVITALS ASSESSMENTS & WORKSPACES (2 COLUMNS) */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* CodeVitals Assessments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit size={15} className="text-emerald-400" />
                <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">Recent CodeVitals</h2>
              </div>
            </div>

            <div className="card divide-y divide-white/[.06] overflow-hidden">
              {recent_assessments.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#77736c]">No technical assessments started yet.</div>
              ) : (
                recent_assessments.map((s) => (
                  <Link
                    key={s.id}
                    href={`/repositories/${s.analysis_id}/codevitals`}
                    className="flex items-center justify-between p-3.5 hover:bg-white/[.02] transition block"
                  >
                    <div>
                      <div className="font-medium text-xs text-white">
                        {s.participant_name ? `${s.participant_name}'s Assessment` : 'CodeVitals Session'}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-[#77736c]">
                        <span>Scope: {s.assessment_type}</span>
                        <span>·</span>
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {s.score !== null && s.score !== undefined ? (
                        <span className="font-mono text-xs font-bold text-amber-400">{s.score}%</span>
                      ) : (
                        <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[10px] text-[#aaa69e]">{s.status}</span>
                      )}
                      <ArrowRight size={13} className="text-[#77736c]" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Workspaces */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-amber-400" />
                <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">My Workspaces</h2>
              </div>
              <Link href="/workspaces" className="text-xs text-amber-400 hover:underline font-mono">View All →</Link>
            </div>

            <div className="card divide-y divide-white/[.06] overflow-hidden">
              {workspaces.map((w) => (
                <Link
                  key={w.id}
                  href={`/workspaces/${w.id}`}
                  className="flex items-center justify-between p-3.5 hover:bg-white/[.02] transition block"
                >
                  <div>
                    <div className="font-semibold text-xs text-white">{w.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#77736c] truncate max-w-[240px]">
                      {w.description || 'Collaborative team workspace'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-[10px] text-[#aaa69e] uppercase">
                      {w.workspace_type}
                    </span>
                    <ArrowRight size={13} className="text-[#77736c]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
