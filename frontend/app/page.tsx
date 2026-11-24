'use client'

import Link from 'next/link'
import {
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Code2,
  FileText,
  GitPullRequest,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  FolderGit2,
} from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

const capabilities = [
  {
    icon: GitBranch,
    badge: 'Anatomy',
    title: 'Architecture & Dependencies',
    description:
      'Interactive visual graph of subsystem boundaries, package dependencies, imports, and circular cycles.',
    href: '/features/anatomy',
  },
  {
    icon: ShieldCheck,
    badge: 'Diagnostics',
    title: 'Evidence-Backed Findings',
    description:
      'Static analysis and security heuristics identifying maintainability risks, anti-patterns, and contract violations.',
    href: '/features/diagnostics',
  },
  {
    icon: FileText,
    badge: 'Case Report',
    title: 'Executive & Technical Case Reports',
    description:
      'Standardized technical documentation with structured summaries, diagnostic breakdowns, and remediation plans.',
    href: '/analyze',
  },
  {
    icon: Code2,
    badge: 'CodeVitals',
    title: 'Codebase Knowledge Assessment',
    description:
      'Intelligent repository-specific technical assessments, component-focused evaluations, and team readiness tracking.',
    href: '/features/codevitals',
  },
  {
    icon: GitPullRequest,
    badge: 'PR Autopsy',
    title: 'Automated Pull Request Intelligence',
    description:
      'Change-impact analysis, regression detection, circular dependency checks, and targeted test recommendations.',
    href: '/features/pr-autopsy',
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
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <main className="grid-bg overflow-hidden">
        {/* HERO SECTION */}
        <section className="border-b border-white/[.08] relative pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
              {/* LEFT COLUMN: Product Value Proposition */}
              <div className="min-w-0 lg:col-span-7 xl:col-span-6 space-y-5 sm:space-y-6">
                <div className="inline-flex max-w-full items-center gap-1.5 xs:gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 xs:px-3 py-1 font-mono text-[10px] xs:text-[11px] uppercase tracking-wider text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="truncate">CODEBASE INTELLIGENCE</span>
                </div>

                <h1 className="text-xl xs:text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[48px] leading-[1.15] break-words">
                  Understand your codebase.
                  <span className="block text-[#9ca3af] mt-1.5 font-normal text-lg xs:text-2xl sm:text-3xl md:text-4xl lg:text-[36px] break-words">
                    Diagnose. Defend. Verify.
                  </span>
                </h1>

                <p className="text-xs xs:text-sm sm:text-base leading-relaxed text-[#9ca3af] max-w-xl">
                  Explore repository architecture, investigate evidence-backed diagnostics, generate technical reports, and assess your team&apos;s codebase knowledge.
                </p>

                {/* Primary & Secondary Actions */}
                <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 pt-2">
                  <Link href="/analyze" className="w-full xs:w-auto">
                    <Button variant="primary" size="md" className="w-full xs:w-auto gap-2 font-semibold justify-center">
                      <span>Start Analyzing</span>
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                  <a href="#capabilities" className="w-full xs:w-auto">
                    <Button variant="secondary" size="md" className="w-full xs:w-auto justify-center">
                      Explore Capabilities
                    </Button>
                  </a>
                </div>

                {/* Technical Trust Strip */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-mono text-[#6b7280] pt-2">
                  <span className="inline-flex items-center gap-1.5 text-[#9ca3af]">
                    <CheckCircle2 size={13} className="text-amber-400 shrink-0" /> Deterministic AST Analysis
                  </span>
                  <span className="hidden sm:inline" aria-hidden="true">•</span>
                  <span>Public & Private Repos</span>
                  <span className="hidden sm:inline" aria-hidden="true">•</span>
                  <span>Zero Installation</span>
                </div>
              </div>

              {/* RIGHT COLUMN: Realistic Restrained Product Preview */}
              <div className="min-w-0 lg:col-span-5 xl:col-span-6">
                <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
                  {/* Subtle ambient glow behind card */}
                  <div className="absolute -inset-1 rounded-2xl bg-amber-400/5 blur-xl -z-10" />

                  <div className="rounded-xl border border-white/[.12] bg-[#0c0f13] shadow-2xl overflow-hidden text-[#f3f4f6]">
                    {/* Window Header */}
                    <div className="flex items-center justify-between border-b border-white/[.08] bg-[#0e1116] px-3 sm:px-4 py-2.5 gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <div className="flex gap-1.5 shrink-0">
                          <div className="h-2.5 w-2.5 rounded-full bg-white/[.12]" />
                          <div className="h-2.5 w-2.5 rounded-full bg-white/[.12]" />
                          <div className="h-2.5 w-2.5 rounded-full bg-white/[.12]" />
                        </div>
                        <span className="ml-1 sm:ml-2 font-mono text-[11px] text-[#6b7280] flex items-center gap-1.5 min-w-0">
                          <FolderGit2 size={12} className="text-[#9ca3af] shrink-0" />
                          <span className="truncate max-w-[100px] xs:max-w-none">repoautopsy/core-engine</span>
                        </span>
                        <span className="hidden xs:inline-block rounded bg-white/[.04] px-1.5 py-0.5 font-mono text-[10px] text-[#9ca3af] border border-white/[.06] shrink-0">
                          main
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] xs:text-[10px] uppercase tracking-wider text-amber-300 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span><span className="hidden xs:inline">Example </span>Preview</span>
                      </div>
                    </div>

                    {/* Preview Subheader Tabs */}
                    <div className="flex items-center gap-3 sm:gap-4 border-b border-white/[.06] bg-[#0b0d10] px-3 sm:px-4 text-xs font-mono overflow-x-auto no-scrollbar">
                      <div className="border-b-2 border-amber-400 py-2 font-medium text-white flex items-center gap-1.5 shrink-0">
                        <GitBranch size={12} className="text-amber-400" />
                        <span>Architecture</span>
                      </div>
                      <div className="py-2 text-[#6b7280] flex items-center gap-1.5 shrink-0">
                        <ShieldAlert size={12} />
                        <span>Diagnostics (2)</span>
                      </div>
                      <div className="py-2 text-[#6b7280] flex items-center gap-1.5 shrink-0">
                        <Code2 size={12} />
                        <span>CodeVitals</span>
                      </div>
                    </div>

                    {/* Preview Body */}
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Architecture Subsystem Pipeline */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b7280]">
                            Component Architecture Graph
                          </span>
                          <span className="font-mono text-[10px] text-amber-400/80">
                            AST Extracted
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="rounded border border-white/[.08] bg-white/[.02] p-2 hover:border-amber-400/30 transition-colors">
                            <div className="font-mono text-[10px] text-amber-400/90 font-medium truncate">Web Client</div>
                            <div className="font-mono text-[9px] text-[#6b7280] mt-0.5">Next.js 16</div>
                          </div>
                          <div className="rounded border border-white/[.08] bg-white/[.02] p-2 hover:border-amber-400/30 transition-colors">
                            <div className="font-mono text-[10px] text-amber-400/90 font-medium truncate">API Gateway</div>
                            <div className="font-mono text-[9px] text-[#6b7280] mt-0.5">FastAPI</div>
                          </div>
                          <div className="rounded border border-white/[.08] bg-white/[.02] p-2 hover:border-amber-400/30 transition-colors">
                            <div className="font-mono text-[10px] text-amber-400/90 font-medium truncate">Analysis AST</div>
                            <div className="font-mono text-[9px] text-[#6b7280] mt-0.5">Engine 2.2</div>
                          </div>
                          <div className="rounded border border-white/[.08] bg-white/[.02] p-2 hover:border-amber-400/30 transition-colors">
                            <div className="font-mono text-[10px] text-amber-400/90 font-medium truncate">Knowledge DB</div>
                            <div className="font-mono text-[9px] text-[#6b7280] mt-0.5">PostgreSQL</div>
                          </div>
                        </div>

                        <div className="mt-1 hidden sm:flex items-center justify-between px-6 text-[#4b5563] text-[10px] font-mono select-none" aria-hidden="true">
                          <span>──────►</span>
                          <span>──────►</span>
                          <span>──────►</span>
                        </div>
                      </div>

                      {/* Evidence-Backed Findings Preview */}
                      <div className="border-t border-white/[.06] pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#6b7280]">
                            Diagnostics & Findings
                          </span>
                          <span className="font-mono text-[10px] text-emerald-400/80">
                            Verified Rules
                          </span>
                        </div>

                        <div className="rounded border border-amber-400/20 bg-amber-400/[.03] p-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-amber-200 text-[11px]">
                              <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                              <span className="truncate">Circular import cycle</span>
                            </div>
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 shrink-0">
                              Warning
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-[#9ca3af]">
                            <span className="text-[#d1d5db]">auth_service.py</span>
                            <span className="text-amber-400">⇄</span>
                            <span className="text-[#d1d5db]">session_manager.py</span>
                            <span className="text-[#6b7280] sm:ml-auto">AST-DEP-02</span>
                          </div>
                        </div>

                        <div className="rounded border border-white/[.08] bg-white/[.02] p-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-[#e5e7eb] text-[11px]">
                              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                              <span className="truncate">Workspace isolation boundaries</span>
                            </div>
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 shrink-0">
                              Verified
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] text-[#9ca3af]">
                            <span>Strict tenant_id checks enforced</span>
                            <span className="text-emerald-400/80">100% Pass</span>
                          </div>
                        </div>
                      </div>

                      {/* Metric Status Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[.06] pt-2 text-[10px] font-mono text-[#6b7280]">
                        <span>Components: <strong className="text-[#d1d5db]">14</strong></span>
                        <span>Dependencies: <strong className="text-[#d1d5db]">38</strong></span>
                        <span>Health Score: <strong className="text-amber-400">92/100</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE CAPABILITIES */}
        <section id="capabilities" className="border-b border-white/[.08] py-16 sm:py-20">
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

                    <Link
                      href={cap.href}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-400 hover:text-amber-300 transition-colors pt-2"
                    >
                      <span>Explore {cap.badge}</span>
                      <ArrowRight size={12} />
                    </Link>
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
        <section className="py-16 sm:py-20 border-b border-white/[.08]">
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

        {/* CRAWLABLE TECHNICAL SEO FOOTER */}
        <footer className="py-12 sm:py-16 bg-[#08090b]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {/* BRAND COLUMN */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/[.04] border border-white/[.12]">
                    <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
                      <path d="M15 18L7 32L15 46" stroke="#EAB308" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 32H22L25 35L30 15L35 49L39 27L42 32H46" stroke="#EAB308" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M49 18L57 32L49 46" stroke="#EAB308" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="font-mono text-sm font-bold tracking-wider text-white">
                    REPO<span className="text-amber-400">AUTOPSY</span>
                  </span>
                </div>
                <p className="text-xs text-[#9ca3af] leading-relaxed max-w-xs">
                  Deterministic codebase intelligence and architectural diagnostics for GitHub repositories. Grounded in abstract syntax trees and dependency graphs.
                </p>
              </div>

              {/* FEATURES COLUMN */}
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
                  Platform Features
                </div>
                <ul className="space-y-2 text-xs text-[#9ca3af]">
                  <li>
                    <Link href="/features/anatomy" className="hover:text-white transition-colors">
                      Architecture Visualizer
                    </Link>
                  </li>
                  <li>
                    <Link href="/features/diagnostics" className="hover:text-white transition-colors">
                      Codebase Diagnostics
                    </Link>
                  </li>
                  <li>
                    <Link href="/features/codevitals" className="hover:text-white transition-colors">
                      CodeVitals Assessment
                    </Link>
                  </li>
                  <li>
                    <Link href="/features/pr-autopsy" className="hover:text-white transition-colors">
                      Pull Request Autopsy
                    </Link>
                  </li>
                </ul>
              </div>

              {/* PRODUCT & EXPLORATION */}
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
                  Tools & Workspaces
                </div>
                <ul className="space-y-2 text-xs text-[#9ca3af]">
                  <li>
                    <Link href="/analyze" className="hover:text-white transition-colors">
                      Analyze a GitHub Repository
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="hover:text-white transition-colors">
                      Personal Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/workspaces" className="hover:text-white transition-colors">
                      Team Workspaces
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://github.com/arshchauhan28/RepoAutopsy"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      <span>Open Source GitHub</span>
                      <ArrowRight size={10} />
                    </a>
                  </li>
                </ul>
              </div>

              {/* METHODOLOGY & INTEGRITY */}
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
                  Engineering Integrity
                </div>
                <ul className="space-y-2 text-xs text-[#9ca3af]">
                  <li>
                    <span className="text-[#d1d5db]">Deterministic AST Heuristics</span>
                  </li>
                  <li>
                    <span className="text-[#d1d5db]">2,500 File Safeguard Enforced</span>
                  </li>
                  <li>
                    <span className="text-[#d1d5db]">Full Coverage Transparency</span>
                  </li>
                  <li>
                    <span className="text-[#d1d5db]">Repository-Grounded Questions</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-white/[.08] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6b7280]">
              <p>© 2026 RepoAutopsy. All rights reserved.</p>
              <p className="font-mono text-[11px]">
                https://repoautopsy.vercel.app · Production SEO Verified
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
