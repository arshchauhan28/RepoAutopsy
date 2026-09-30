'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bot,
  FileCode2,
  GitBranch,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { Nav } from '@/components/Nav'
import { ArchitectureMap } from '@/components/ArchitectureMap'
import { FindingList } from '@/components/FindingList'
import { MetricCard } from '@/components/MetricCard'
import { StatusPill } from '@/components/StatusPill'
import { getAnalysis, type Analysis } from '@/lib/api'

export default function RepositoryPage() {
  const params = useParams<{ id: string }>()

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState('')

  async function load() {
    try {
      setAnalysis(await getAnalysis(params.id))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Unable to load repository')
    }
  }

  useEffect(() => {
    load()
  }, [params.id])

  useEffect(() => {
    if (
      !analysis ||
      !['queued', 'running'].includes(analysis.status)
    ) {
      return
    }

    const timer = setInterval(load, 2500)

    return () => clearInterval(timer)
  }, [analysis?.status, params.id])

  const metrics = analysis?.metrics || {}
  const findings = analysis?.findings || []

  const security = findings.filter(
    (f) => f.category === 'security'
  ).length

  const quality = findings.filter(
    (f) => f.category === 'quality'
  ).length

  const languages = useMemo(
    () =>
      Object.entries(analysis?.languages || {}).slice(0, 6),
    [analysis]
  )

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav />

        <main className="mx-auto max-w-3xl px-5 py-20">
          <div className="card p-8 text-rose-300">
            {error}
          </div>
        </main>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="min-h-screen">
        <Nav />

        <main className="mx-auto max-w-5xl px-5 py-20 text-slate-400">
          Loading repository…
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-7xl px-5 py-8 pb-20">

        {/* Header */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {analysis.owner}/{analysis.repo_name}
              </h1>

              <StatusPill status={analysis.status} />
            </div>

            <a
              className="mt-2 inline-block text-sm text-violet-300 hover:text-violet-200"
              href={analysis.github_url}
              target="_blank"
              rel="noreferrer"
            >
              {analysis.github_url}
            </a>
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* Analysis progress */}
        {(analysis.status === 'queued' ||
          analysis.status === 'running') && (
          <div className="card mt-7 overflow-hidden">
            <div className="h-1 w-full bg-white/5">
              <div className="h-full w-1/2 animate-pulse bg-gradient-to-r from-violet-500 to-cyan-400" />
            </div>

            <div className="p-7">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 animate-glow rounded-full bg-cyan-300" />

                <h2 className="font-medium">
                  {analysis.status === 'queued'
                    ? 'Analysis queued'
                    : 'Analyzing repository'}
                </h2>
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                RepoAutopsy is fetching the repository and building
                static evidence. This page refreshes automatically.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white/[.03] p-4 text-sm text-slate-400">
                  Repository fetched
                </div>

                <div className="rounded-xl bg-white/[.03] p-4 text-sm text-slate-400">
                  Code structure parsed
                </div>

                <div className="rounded-xl bg-white/[.03] p-4 text-sm text-slate-400">
                  AI insights prepared
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Failed */}
        {analysis.status === 'failed' && (
          <div className="mt-7 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5 text-sm text-rose-300">
            {analysis.error || 'The analysis failed.'}
          </div>
        )}

        {/* Completed */}
        {analysis.status === 'completed' && (
          <>
            {/* Metrics */}
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Files"
                value={metrics.total_files || 0}
              />

              <MetricCard
                label="Code lines"
                value={(metrics.code_lines || 0).toLocaleString()}
              />

              <MetricCard
                label="Functions"
                value={metrics.functions || 0}
              />

              <MetricCard
                label="Security"
                value={security}
                detail="detected findings"
              />

              <MetricCard
                label="Quality"
                value={quality}
                detail="review findings"
              />
            </div>

            {/* Main content */}
            <div className="mt-7 grid gap-7 lg:grid-cols-[1.35fr_.65fr]">

              {/* Left column */}
              <div className="space-y-7">

                {/* Architecture */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Architecture
                      </h2>

                      <p className="text-sm text-slate-500">
                        Derived from repository structure and detected imports.
                      </p>
                    </div>

                    <GitBranch
                      className="text-violet-300"
                      size={19}
                    />
                  </div>

                  <ArchitectureMap
                    architecture={analysis.architecture}
                  />
                </section>

                {/* Codebase Doctor */}
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Codebase Doctor
                      </h2>

                      <p className="text-sm text-slate-500">
                        Static findings to investigate before production.
                      </p>
                    </div>

                    <ShieldAlert
                      className="text-amber-300"
                      size={19}
                    />
                  </div>

                  <FindingList findings={findings} />
                </section>
              </div>

              {/* Right column */}
              <aside className="space-y-5">

                {/* AI Review */}
                <div className="card p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      size={17}
                      className="text-violet-300"
                    />

                    <h2 className="font-medium">
                      AI review
                    </h2>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {analysis.summary}
                  </p>

                  <div className="mt-5 space-y-4">
                    {(analysis.ai_insights?.priorities || [])
                      .slice(0, 4)
                      .map((x: string) => (
                        <div
                          key={x}
                          className="rounded-xl bg-white/[.03] p-3 text-xs leading-5 text-slate-400"
                        >
                          {x}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Languages */}
                <div className="card p-5">
                  <div className="flex items-center gap-2">
                    <FileCode2
                      size={17}
                      className="text-cyan-300"
                    />

                    <h2 className="font-medium">
                      Languages
                    </h2>
                  </div>

                  <div className="mt-4 space-y-3">
                    {languages.map(([name, count]) => (
                      <div key={name}>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300">
                            {name}
                          </span>

                          <span className="text-slate-500">
                            {count as number} files
                          </span>
                        </div>

                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                            style={{
                              width: `${Math.max(
                                6,
                                ((count as number) /
                                  (metrics.total_files || 1)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interview */}
                <div className="card p-5">
                  <Bot
                    size={18}
                    className="text-emerald-300"
                  />

                  <h2 className="mt-3 font-medium">
                    Ready for the interview?
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Answer questions generated from this repository,
                    then review where your explanation needs more depth.
                  </p>

                  <Link
                    href={`/repositories/${analysis.id}/interview`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 transition-all duration-200 hover:from-violet-500 hover:to-cyan-400 hover:shadow-violet-500/20"
                  >
                    Start AI interview
                    <ArrowRight size={15} />
                  </Link>
                </div>

              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}