import type { Metadata } from 'next'
import Link from 'next/link'
import { BrainCircuit, ArrowRight, CheckCircle2, Users, Target, RefreshCw, Trophy, FileText, AlertCircle } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Test Your Codebase Knowledge with CodeVitals',
  description:
    'Evaluate architectural comprehension, subsystem boundaries, and failure modes through personalized technical questions grounded in your repository.',
  alternates: {
    canonical: '/features/codevitals',
  },
  openGraph: {
    title: 'Test Your Codebase Knowledge with CodeVitals | RepoAutopsy',
    description:
      'Defend your codebase understanding with deterministic, syntax-tree grounded assessment challenges.',
    url: '/features/codevitals',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RepoAutopsy - Test Your Codebase Knowledge with CodeVitals',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Test Your Codebase Knowledge with CodeVitals | RepoAutopsy',
    description:
      'Defend your codebase understanding with deterministic, syntax-tree grounded assessment challenges.',
    images: ['/og-image.png'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Test Your Codebase Knowledge with CodeVitals',
  url: 'https://repoautopsy.vercel.app/features/codevitals',
  description:
    'Evaluate architectural comprehension, subsystem boundaries, and failure modes through personalized technical questions grounded in your repository.',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://repoautopsy.vercel.app',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Features',
        item: 'https://repoautopsy.vercel.app/#capabilities',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'CodeVitals Knowledge Assessment',
        item: 'https://repoautopsy.vercel.app/features/codevitals',
      },
    ],
  },
}

export default function CodeVitalsFeaturePage() {
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f4f6]">
      <Nav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 space-y-16">
        {/* HERO SECTION */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#9ca3af]">
            <Link href="/" className="hover:text-amber-400 transition-colors">Home</Link>
            <span>/</span>
            <span>Features</span>
            <span>/</span>
            <span className="text-amber-400">CodeVitals</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-amber-300">
            <BrainCircuit size={13} />
            <span>Knowledge Assessment</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Defend Your Codebase Understanding with CodeVitals
          </h1>

          <p className="text-base sm:text-lg text-[#9ca3af] leading-relaxed max-w-3xl">
            Reading documentation or browsing files does not test whether an engineer truly understands how a system behaves under failure. CodeVitals generates technical questions directly from your repository&apos;s AST and import graph to assess architectural comprehension.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/analyze">
              <Button variant="primary" size="md">
                Launch CodeVitals Assessment <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/features/pr-autopsy">
              <Button variant="secondary" size="md">
                Explore PR Autopsy
              </Button>
            </Link>
          </div>
        </section>

        {/* ASSESSMENT MODES */}
        <section className="space-y-8 border-t border-white/[.08] pt-12">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-amber-400">Assessment Workflows</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              Targeted evaluations for individuals and teams
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <Target size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Complete Codebase Mode</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Broad architectural evaluation covering high-level subsystem responsibilities, configuration lifecycles, and core cross-module orchestration.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 grid place-items-center">
                <FileText size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Component-Scoped Mode</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Drill deep into a specific component (e.g. `auth_service`, `billing_worker`, `data_pipeline`). Perfect for onboarding engineers onto a new subsystem.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 grid place-items-center">
                <Users size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Team & Hackathon Readiness</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Generate invite tokens for team members to benchmark collective system understanding. Track team heatmaps, knowledge gaps, and onboarding speed.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 grid place-items-center">
                <RefreshCw size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Practice & Iterative Retakes</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Retake assessments to solidify memory and track improvement over time. Review step-by-step explanations referencing exact source files.
              </p>
            </div>
          </div>
        </section>

        {/* REPOSITORY EVIDENCE GROUNDING */}
        <section className="rounded-xl border border-white/[.08] bg-white/[.02] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
            <AlertCircle size={14} />
            <span>Repository-Grounded Questions</span>
          </div>
          <h3 className="text-lg font-semibold text-white">Questions Backed by Source Code Evidence</h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            CodeVitals generates questions using repository analysis and source evidence. Automated validation reduces unsupported questions, but generated content may still contain inaccuracies. If a selected component lacks sufficient evidence to formulate valid questions, CodeVitals transparently pauses and informs the user upfront rather than inventing generic filler.
          </p>
        </section>

        {/* BOTTOM CTA */}
        <section className="rounded-xl border border-white/[.12] bg-[#0c0f13] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Evaluate your repository knowledge</h3>
            <p className="mt-1 text-sm text-[#9ca3af]">
              Select question count (5, 10, 15, or 20) and test your architectural comprehension.
            </p>
          </div>
          <Link href="/analyze">
            <Button variant="primary" size="md">
              Start CodeVitals Assessment <ArrowRight size={14} />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  )
}
