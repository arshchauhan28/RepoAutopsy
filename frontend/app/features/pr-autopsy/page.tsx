import type { Metadata } from 'next'
import Link from 'next/link'
import { GitPullRequest, ArrowRight, ShieldCheck, GitCompare, AlertTriangle, FileCode2, CheckCircle2, Info } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'GitHub Pull Request Analyzer & Impact Review',
  description:
    'Automate change impact analysis, regression detection, circular dependency checks, and targeted test recommendations on GitHub pull requests.',
  alternates: {
    canonical: '/features/pr-autopsy',
  },
  openGraph: {
    title: 'GitHub Pull Request Analyzer & Impact Review | RepoAutopsy',
    description:
      'Evaluate PR change blast radius, detect regressions, and prioritize code reviews with automated pull request autopsy.',
    url: '/features/pr-autopsy',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RepoAutopsy - GitHub Pull Request Analyzer & Impact Review',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitHub Pull Request Analyzer & Impact Review | RepoAutopsy',
    description:
      'Evaluate PR change blast radius, detect regressions, and prioritize code reviews with automated pull request autopsy.',
    images: ['/og-image.png'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'GitHub Pull Request Analyzer & Impact Review',
  url: 'https://repoautopsy.vercel.app/features/pr-autopsy',
  description:
    'Automate change impact analysis, regression detection, circular dependency checks, and targeted test recommendations on GitHub pull requests.',
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
        name: 'PR Autopsy',
        item: 'https://repoautopsy.vercel.app/features/pr-autopsy',
      },
    ],
  },
}

export default function PRAutopsyFeaturePage() {
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
            <span className="text-amber-400">PR Autopsy</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-indigo-300">
            <GitPullRequest size={13} />
            <span>Automated Pull Request Review</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            GitHub Pull Request Analyzer & Change-Impact Intelligence
          </h1>

          <p className="text-base sm:text-lg text-[#9ca3af] leading-relaxed max-w-3xl">
            Reviewing large pull requests by scrolling through raw diffs leaves blind spots. PR Autopsy compares the base and head trees to calculate blast radius, detect newly introduced circular cycles, and prioritize review attention before merge.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/analyze">
              <Button variant="primary" size="md">
                Analyze a Pull Request <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/features/anatomy">
              <Button variant="secondary" size="md">
                Explore Architecture Maps
              </Button>
            </Link>
          </div>
        </section>

        {/* PR REVIEW CAPABILITIES */}
        <section className="space-y-8 border-t border-white/[.08] pt-12">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-amber-400">PR Intelligence Signals</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              Smarter code review beyond surface syntax
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 grid place-items-center">
                <GitCompare size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Architectural Blast Radius</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Determines how many downstream modules depend on the files modified in the PR. High-blast-radius diffs receive elevated review priority badges.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 grid place-items-center">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">New Cycle & Regression Detection</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Identifies whether a pull request inadvertently introduces a circular import or breaks architectural boundary rules that were previously clean.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <FileCode2 size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Targeted Test Recommendations</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Pinpoints which test suites exercise the changed modules, advising reviewers which tests are critical to execute before approval.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 grid place-items-center">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Review Priority Scoring</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Classifies PRs into High, Medium, or Low review priority based on complexity delta, security surface changes, and dependency modifications.
              </p>
            </div>
          </div>
        </section>

        {/* HONEST LIMITATIONS */}
        <section className="rounded-xl border border-white/[.08] bg-white/[.02] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
            <Info size={14} />
            <span>Automated Review Limitations</span>
          </div>
          <h3 className="text-lg font-semibold text-white">Assistance, Not an Autonomous Substitute</h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            PR Autopsy accelerates human engineering review by surfacing structural risk and regression signals. It does not replace human domain expertise, runtime integration testing, or business logic validation. Automated approvals should never bypass engineering scrutiny.
          </p>
        </section>

        {/* BOTTOM CTA */}
        <section className="rounded-xl border border-white/[.12] bg-[#0c0f13] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Analyze a GitHub Pull Request</h3>
            <p className="mt-1 text-sm text-[#9ca3af]">
              Enter a repository or PR URL to view change impact, diagnostics, and test recommendations.
            </p>
          </div>
          <Link href="/analyze">
            <Button variant="primary" size="md">
              Start Free Analysis <ArrowRight size={14} />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  )
}
