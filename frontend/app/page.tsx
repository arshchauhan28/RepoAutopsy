'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Code2,
  FileText,
  GitPullRequest,
  Github,
  CheckCircle2,
  Terminal,
  Search,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const capabilities = [
  {
    icon: GitBranch,
    badge: 'Anatomy',
    title: 'Architecture & Dependencies',
    description:
      'Interactive visual graph of subsystem boundaries, package dependencies, imports, and circular cycles.',
  },
  {
    icon: ShieldCheck,
    badge: 'Diagnostics',
    title: 'Evidence-Backed Findings',
    description:
      'Static analysis and security heuristics identifying maintainability risks, anti-patterns, and contract violations.',
  },
  {
    icon: FileText,
    badge: 'Case Report',
    title: 'Executive & Technical Case Reports',
    description:
      'Standardized technical documentation with structured summaries, diagnostic breakdowns, and remediation plans.',
  },
  {
    icon: Code2,
    badge: 'CodeVitals',
    title: 'Codebase Knowledge Assessment',
    description:
      'Intelligent repository-specific technical assessments, component-focused evaluations, and team readiness tracking.',
  },
  {
    icon: GitPullRequest,
    badge: 'PR Autopsy',
    title: 'Automated Pull Request Intelligence',
    description:
      'Change-impact analysis, regression detection, circular dependency checks, and targeted test recommendations.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Connect & Ingest',
    description: 'Provide a GitHub repository URL or connect via GitHub App webhook automation.',
  },
  {
    step: '02',
    title: 'Anatomy & AST Analysis',
    description: 'Parse source files, build module hierarchy, and extract internal import dependency graphs.',
  },
  {
    step: '03',
    title: 'Diagnostics & Metrics',
    description: 'Execute deterministic diagnostic heuristics to detect circular cycles, dead code, and complexity.',
  },
  {
    step: '04',
    title: 'Assess & Defend',
    description: 'Review findings in the Case Report, test team implementation knowledge with CodeVitals, and verify PRs.',
  },
]

export default function Home() {
  const router = useRouter()
  const [repoUrl, setRepoUrl] = useState('')

  const handleAnalyzeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (repoUrl.trim()) {
      router.push(`/analyze?url=${encodeURIComponent(repoUrl.trim())}`)
    } else {
      router.push('/analyze')
    }
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="grid-bg overflow-hidden">
        {/* HERO SECTION */}
        <section className="border-b border-white/[.08] relative">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Developer Codebase Intelligence
              </div>

              <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
                Understand your codebase.
                <span className="block text-[#9ca3af] mt-1">Diagnose, defend, and verify.</span>
              </h1>

              <p className="mt-6 text-sm sm:text-base leading-relaxed text-[#9ca3af] max-w-2xl">
                RepoAutopsy turns any GitHub repository into an interactive architectural anatomy map, evidence-backed diagnostics, an executive case report, and team knowledge assessments.
              </p>

              {/* QUICK REPOSITORY URL INPUT */}
              <form onSubmit={handleAnalyzeSubmit} className="mt-8 flex flex-col sm:flex-row gap-2 max-w-xl">
                <div className="relative flex-1">
                  <Input
                    type="url"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    leftIcon={<Github size={16} />}
                    className="h-11 bg-black/40 text-sm"
                    aria-label="GitHub Repository URL"
                  />
                </div>
                <Button type="submit" variant="primary" size="md" className="h-11 whitespace-nowrap">
                  <span>Analyze Repository</span>
                  <ArrowRight size={14} />
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-[#6b7280]">
                <span>Public & Private Repositories</span>
                <span>•</span>
                <span>Zero Installation Required</span>
                <span>•</span>
                <span>Deterministic AST Analysis</span>
              </div>
            </div>
          </div>
        </section>

        {/* CORE CAPABILITIES */}
        <section className="border-b border-white/[.08] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-widest text-amber-400">Platform Features</span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                Five layers of codebase inspection
              </h2>
              <p className="mt-3 text-sm text-[#9ca3af]">
                Move seamlessly between top-level structure, individual component relationships, code quality findings, and team knowledge.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((cap) => {
                const Icon = cap.icon
                return (
                  <div
                    key={cap.badge}
                    className="rounded-lg border border-white/[.08] bg-[#0d0f12] p-5 sm:p-6 hover:border-white/[.16] transition-colors flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="grid h-9 w-9 place-items-center rounded-md bg-white/[.04] text-amber-400 border border-white/[.08]">
                          <Icon size={18} />
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9ca3af] border border-white/[.08] px-2 py-0.5 rounded">
                          {cap.badge}
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-medium text-white">{cap.title}</h3>
                      <p className="mt-2 text-xs sm:text-sm text-[#9ca3af] leading-relaxed">
                        {cap.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-b border-white/[.08] py-16 sm:py-20 bg-white/[.01]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-widest text-amber-400">Methodology</span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                Predictable, evidence-first engineering
              </h2>
              <p className="mt-3 text-sm text-[#9ca3af]">
                RepoAutopsy analyzes actual code syntax trees and dependency graphs before applying diagnostic heuristics and assessment models.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((st) => (
                <div key={st.step} className="border-l border-white/[.1] pl-5 space-y-2">
                  <div className="font-mono text-xs font-semibold text-amber-400">{st.step}</div>
                  <h4 className="text-sm font-medium text-white">{st.title}</h4>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">{st.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-white/[.12] bg-[#0c0f13] p-8 sm:p-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-white">Ready to inspect a repository?</h3>
                <p className="mt-2 text-xs sm:text-sm text-[#9ca3af] max-w-md">
                  Enter a public GitHub repository to get started immediately, or sign in to connect private repositories and collaborate in team workspaces.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/analyze">
                  <Button variant="primary" size="md">
                    Start Analysis <ArrowRight size={14} />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="secondary" size="md">
                    View Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
