import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RepoAutopsy — Codebase Doctor & AI Interviewer',
  description: 'Analyze a GitHub repository, understand its architecture, and practice a project-specific technical interview.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
