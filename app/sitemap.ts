import { MetadataRoute } from 'next'
import { listPersonas } from '@/lib/personas'

export default function sitemap(): MetadataRoute.Sitemap {
  const personas = listPersonas()

  const personaEntries = personas.map(p => ({
    url: `https://other-life.vercel.app/p/${p.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://other-life.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...personaEntries,
  ]
}
