import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analyze a GitHub Repository',
  description:
    'Inspect public GitHub repositories, run deterministic AST diagnostics, and build interactive architecture dependency graphs.',
  alternates: {
    canonical: '/analyze',
  },
  openGraph: {
    title: 'Analyze a GitHub Repository | RepoAutopsy',
    description:
      'Inspect public GitHub repositories, run deterministic AST diagnostics, and build interactive architecture dependency graphs.',
    url: '/analyze',
  },
  twitter: {
    title: 'Analyze a GitHub Repository | RepoAutopsy',
    description:
      'Inspect public GitHub repositories, run deterministic AST diagnostics, and build interactive architecture dependency graphs.',
  },
}

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
