import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Repository Analysis Report',
  description:
    'Explore codebase anatomy, diagnostic findings, case reports, and CodeVitals defense assessments.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function RepositoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
