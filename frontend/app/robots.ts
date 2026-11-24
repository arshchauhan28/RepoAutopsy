import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/analyze', '/features/'],
        disallow: ['/api/', '/dashboard', '/workspaces/', '/auth/'],
      },
    ],
    sitemap: 'https://repoautopsy.vercel.app/sitemap.xml',
  }
}
