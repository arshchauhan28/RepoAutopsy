import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://repoautopsy.vercel.app'),
  title: {
    default: 'RepoAutopsy — GitHub Repository & Codebase Analyzer',
    template: '%s | RepoAutopsy',
  },
  description:
    'Analyze GitHub repositories, visualize architecture, explore dependencies, detect code issues, and test your codebase knowledge with RepoAutopsy.',
  applicationName: 'RepoAutopsy',
  authors: [{ name: 'RepoAutopsy Team' }],
  generator: 'Next.js',
  keywords: [
    'GitHub repository analyzer',
    'codebase analysis tool',
    'GitHub code analyzer',
    'understand GitHub repository',
    'repository architecture visualizer',
    'code dependency graph',
    'GitHub pull request analyzer',
    'codebase understanding tool',
    'CodeVitals',
    'static analysis AST',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://repoautopsy.vercel.app',
    siteName: 'RepoAutopsy',
    title: 'RepoAutopsy — GitHub Repository & Codebase Analyzer',
    description:
      'Analyze GitHub repositories, visualize architecture, explore dependencies, detect code issues, and test your codebase knowledge with RepoAutopsy.',
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
    title: 'RepoAutopsy — GitHub Repository & Codebase Analyzer',
    description:
      'Analyze GitHub repositories, visualize architecture, explore dependencies, detect code issues, and test your codebase knowledge with RepoAutopsy.',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://repoautopsy.vercel.app/#website',
      url: 'https://repoautopsy.vercel.app',
      name: 'RepoAutopsy',
      description:
        'Deterministic GitHub repository analyzer, architecture visualizer, and codebase diagnostic engine.',
      inLanguage: 'en-US',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://repoautopsy.vercel.app/#application',
      name: 'RepoAutopsy',
      url: 'https://repoautopsy.vercel.app',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description:
        'Analyze GitHub repositories, visualize architecture, explore dependencies, detect code issues, and test your codebase knowledge with RepoAutopsy.',
    },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
