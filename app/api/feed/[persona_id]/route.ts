import { NextRequest, NextResponse } from 'next/server'
import { getPublicFeed } from '@/lib/feed'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  const { persona_id } = await params
  const feed = await getPublicFeed(persona_id)

  if (!feed) {
    return NextResponse.json({ error: '피드 없음' }, { status: 404 })
  }

  // 캐싱 허용 (CDN 엣지 캐시 30분) + 스크래핑 억제
  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}
