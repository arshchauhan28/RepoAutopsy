import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://repoautopsy.vercel.app'),
  title: {
    default: 'RepoAutopsy — Understand Your Codebase',
    template: '%s | RepoAutopsy',
  },
  description:
    'Analyze GitHub repositories, explore architecture, uncover code issues, and test your understanding with CodeVitals.',
  applicationName: 'RepoAutopsy',
  authors: [{ name: 'RepoAutopsy Team' }],
  generator: 'Next.js',
  keywords: [
    'GitHub',
    'codebase analysis',
    'AST static analysis',
    'software architecture',
    'code quality',
    'security diagnostics',
    'CodeVitals',
    'PR autopsy',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://repoautopsy.vercel.app',
    siteName: 'RepoAutopsy',
    title: 'RepoAutopsy — Understand Your Codebase',
    description:
      'Analyze GitHub repositories, explore architecture, uncover code issues, and test your understanding with CodeVitals.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RepoAutopsy developer codebase intelligence and example repository analysis report',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RepoAutopsy — Understand Your Codebase',
    description:
      'Explore code architecture, identify issues, and test your repository knowledge.',
    images: ['/og-image.png'],
  },
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
