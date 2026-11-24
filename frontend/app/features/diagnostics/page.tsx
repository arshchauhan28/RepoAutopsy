import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert, ArrowRight, ShieldCheck, FileSearch, Code2, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Nav } from '@/components/Nav'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Codebase Diagnostics & Repository Analysis',
  description:
    'Detect code quality defects, maintainability risks, security vulnerabilities, and contract violations with evidence-backed static analysis heuristics.',
  alternates: {
    canonical: '/features/diagnostics',
  },
  openGraph: {
    title: 'Codebase Diagnostics & Repository Analysis | RepoAutopsy',
    description:
      'Evidence-backed static analysis heuristics, anti-pattern detection, and coverage transparency across GitHub repositories.',
    url: '/features/diagnostics',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RepoAutopsy - Codebase Diagnostics & Repository Analysis',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codebase Diagnostics & Repository Analysis | RepoAutopsy',
    description:
      'Evidence-backed static analysis heuristics, anti-pattern detection, and coverage transparency across GitHub repositories.',
    images: ['/og-image.png'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Codebase Diagnostics & Repository Analysis',
  url: 'https://repoautopsy.vercel.app/features/diagnostics',
  description:
    'Detect code quality defects, maintainability risks, security vulnerabilities, and contract violations with evidence-backed static analysis heuristics.',
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
        name: 'Diagnostics & Findings',
        item: 'https://repoautopsy.vercel.app/features/diagnostics',
      },
    ],
  },
}

export default function DiagnosticsFeaturePage() {
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
            <span className="text-amber-400">Diagnostics</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-xs uppercase tracking-wider text-amber-300">
            <ShieldAlert size={13} />
            <span>Deterministic Diagnostics</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Evidence-Backed Codebase Diagnostics & Quality Heuristics
          </h1>

          <p className="text-base sm:text-lg text-[#9ca3af] leading-relaxed max-w-3xl">
            Static analysis should ground every warning in verifiable source code locations. RepoAutopsy executes deterministic AST visitor rules to detect security misconfigurations, maintainability anti-patterns, and circular cycles with file, line, and code snippet evidence.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/analyze">
              <Button variant="primary" size="md">
                Run Diagnostics <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/features/codevitals">
              <Button variant="secondary" size="md">
                Explore CodeVitals
              </Button>
            </Link>
          </div>
        </section>

        {/* RULE CATEGORIES */}
        <section className="space-y-8 border-t border-white/[.08] pt-12">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-amber-400">Diagnostic Categories</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
              Rules grounded in concrete repository evidence
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 grid place-items-center">
                <ShieldAlert size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Security & Vulnerability Patterns</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Flags insecure defaults, unsanitized inputs, hardcoded credentials, unsafe deserialization, and dangerous dynamic evaluation patterns.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 grid place-items-center">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Maintainability & Anti-Patterns</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Identifies extreme cyclomatic complexity, excessive parameter lists, sprawling god classes, dead functions, and unhandled exception swallowing.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 grid place-items-center">
                <Code2 size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Contract & API Adherence</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Detects mismatched function signatures, inconsistent return types, missing error propagation, and violations of subsystem boundary contracts.
              </p>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#0d0f12] p-6 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 grid place-items-center">
                <FileSearch size={18} />
              </div>
              <h3 className="text-lg font-semibold text-white">Exact Line-Number Provenance</h3>
              <p className="text-sm text-[#9ca3af] leading-relaxed">
                Every finding links directly to GitHub commit-pinned source lines. No vague AI hallucinations or speculative critique without code evidence.
              </p>
            </div>
          </div>
        </section>

        {/* COVERAGE TRANSPARENCY & INTEGRITY */}
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/[.03] p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-400 font-semibold">
            <Info size={14} />
            <span>Coverage Transparency & Honest Disclosures</span>
          </div>
          <h3 className="text-lg font-semibold text-white">Why 0 Findings Does Not Mean 0 Defects</h3>
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            Many static analysis tools mislead developers by displaying a green &quot;100% Clean&quot; badge when zero rules trigger. RepoAutopsy explicitly rejects this practice. If a repository has partial analysis coverage (e.g. unparsed documentation, non-source configurations, or skipped build assets), RepoAutopsy transparently discloses the exact count of parsed vs unparsed files. Zero detected findings indicates that no active heuristic rules were triggered within parsed AST code—not that the software is mathematically proven defect-free.
          </p>
        </section>

        {/* BOTTOM CTA */}
        <section className="rounded-xl border border-white/[.12] bg-[#0c0f13] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Audit code quality and maintainability risks</h3>
            <p className="mt-1 text-sm text-[#9ca3af]">
              Generate a comprehensive diagnostics breakdown with actionable remediation steps.
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
