import { MetadataRoute } from 'next'
import { listPersonas } from '@/lib/personas'

const BASE_URL = 'https://play.anomess.com'
const LANGS = ['ko', 'ja', 'en'] as const

// Google Search Console에 제출되는 sitemap.xml 자동 생성
// 페르소나당 ko/ja/en 3개 언어 URL 포함 — hreflang과 연동
export default function sitemap(): MetadataRoute.Sitemap {
  const personas = listPersonas()

  const personaRoutes: MetadataRoute.Sitemap = personas.flatMap((p) =>
    LANGS.map((lang) => ({
      url: `${BASE_URL}/p/${p.id}?lang=${lang}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.9,
    }))
  )

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
