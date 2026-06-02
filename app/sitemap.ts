import { MetadataRoute } from 'next'
import { listPersonas } from '@/lib/personas'

const BASE_URL = 'https://play.anomess.com'

// Google Search Console에 제출되는 sitemap.xml 자동 생성
// 페르소나당 canonical URL 1개 (쿼리 파라미터 없음 — Google이 ?lang= 변형을 중복으로 처리해 색인 거부)
export default function sitemap(): MetadataRoute.Sitemap {
  const personas = listPersonas()

  const personaRoutes: MetadataRoute.Sitemap = personas.map((p) => ({
    url: `${BASE_URL}/p/${p.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
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
