import { MetadataRoute } from 'next'
import { listPersonas } from '@/lib/personas'

const BASE_URL = 'https://other-life.vercel.app'

// Google Search Console에 제출되는 sitemap.xml 자동 생성
export default function sitemap(): MetadataRoute.Sitemap {
  const personas = listPersonas()

  const personaRoutes = personas.map((p) => ({
    url: `${BASE_URL}/p/${p.id}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.9,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    ...personaRoutes,
  ]
}
