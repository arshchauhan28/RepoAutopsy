import type { Metadata } from 'next'
import Link from 'next/link'
import { GitBranch, ArrowRight, Layers, Network, Compass, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'GitHub Repository Architecture Visualizer',
  description:
    'Visualize repository subsystem boundaries, extract dependency graphs, map internal imports, and detect circular cycles with RepoAutopsy.',
  alternates: {
    canonical: '/features/anatomy',
  },
  openGraph: {
    title: 'GitHub Repository Architecture Visualizer | RepoAutopsy',
    description:
      'Explore module boundaries, package dependencies, imports, and circular cycles in any public GitHub repository.',
    url: '/features/anatomy',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RepoAutopsy - GitHub Repository Architecture Visualizer',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GitHub Repository Architecture Visualizer | RepoAutopsy',
    description:
      'Explore module boundaries, package dependencies, imports, and circular cycles in any public GitHub repository.',
    images: ['/og-image.png'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'GitHub Repository Architecture Visualizer',
  url: 'https://repoautopsy.vercel.app/features/anatomy',
  description:
    'Visualize repository subsystem boundaries, extract dependency graphs, map internal imports, and detect circular cycles with RepoAutopsy.',
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
        name: 'Architecture Visualizer',
        item: 'https://repoautopsy.vercel.app/features/anatomy',
      },
    ],
  },
}

export default function AnatomyFeaturePage() {
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
            <span className="text-amber-400">Architecture Visualizer</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-amber-300">
            <GitBranch size={13} />
            <span>Codebase Anatomy</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Visualize GitHub Repository Architecture & Dependency Networks
          </h1>

          <p className="text-base sm:text-lg text-[#9ca3af] leading-relaxed max-w-3xl">
            When opening an unfamiliar codebase, understanding how subsystems interact is the highest-friction challenge. RepoAutopsy parses syntax trees, extracts internal imports, and renders an interactive architectural anatomy map so you can explore module boundaries with confidence.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/analyze">
              <Button variant="primary" size="md">
                Analyze a Repository <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/features/diagnostics">
              <Button variant="secondary" size="md">
                Explore Diagnostics
              </Button>
            </Link>
          </div>
        </section>

        {/* CORE CAPABILITIES GRID */}
        <section className="space-y-8 border-t border-white/[.08] pt-12">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-amber-400">Architectural Intelligence</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              What RepoAutopsy extracts from source trees
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <Layers size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Subsystem & Module Hierarchy</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Aggregates files into logical domain boundaries (e.g., authentication, storage, API routers, background workers). See which subsystems contain the highest complexity and code density.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <Network size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Internal Dependency Graphs</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Traces direct and transitive relationships between modules. Visualizes which files are foundational leaf modules and which act as central coordination hubs.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <Compass size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Circular Import Detection</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Identifies circular cycles where Module A imports Module B which imports Module A. Circular dependencies introduce brittle initialization order issues and runtime deadlock risks.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Coupling & Isolation Analysis</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Evaluates architectural cohesion. Highlights tightly-coupled components that should be decoupled into clean service boundaries or public interfaces.
              </p>
            </div>
          </div>
        </section>

        {/* METHODOLOGY & LIMITATIONS */}
        <section className="rounded-xl border border-white/[.08] bg-white/[.02] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
            <AlertCircle size={14} />
            <span>Analysis Scope & Limitations</span>
          </div>
          <h3 className="text-lg font-semibold text-white">How Architectural Discovery Works</h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            RepoAutopsy extracts dependency edges by deterministically parsing source code ASTs (Python, JavaScript, TypeScript, Go). Dynamic imports computed at runtime, non-source binary assets, and unparsed configuration files are classified under our transparent coverage model rather than assumed to be absent.
          </p>
        </section>

        {/* BOTTOM CTA */}
        <section className="rounded-xl border border-white/[.12] bg-[#0c0f13] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Inspect an example repository architecture</h3>
            <p className="mt-1 text-sm text-[#9ca3af]">
              Try verified examples like Starlette, Flask, or Express, or input your own public GitHub repository.
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
