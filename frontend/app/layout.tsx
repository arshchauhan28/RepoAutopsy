import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RepoAutopsy — Codebase Anatomy, Diagnostics & CodeVitals',
  description: 'Analyze a GitHub repository, explore its anatomy, run diagnostics, review case reports, and defend your codebase with CodeVitals.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
