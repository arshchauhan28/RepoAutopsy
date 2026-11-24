import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: 'https://repoautopsy.vercel.app',
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://repoautopsy.vercel.app/analyze',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: 'https://repoautopsy.vercel.app/features/anatomy',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://repoautopsy.vercel.app/features/diagnostics',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://repoautopsy.vercel.app/features/codevitals',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: 'https://repoautopsy.vercel.app/features/pr-autopsy',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]
}
