import { NextRequest, NextResponse } from 'next/server'
import { getPaginatedFeed } from '@/lib/feed'
import { logFeedAccess } from '@/lib/access-log'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  // Rate Limit: IP당 60회/분
  const ip = getClientIp(req)
  const rl = checkRateLimit(ip, 60, 60)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  const { persona_id } = await params
  const { searchParams } = req.nextUrl

  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

  // 첫 페이지 요청만 접근 로그 기록
  if (offset === 0) logFeedAccess(req, persona_id)

  const feed = await getPaginatedFeed(persona_id, offset, limit)

  if (!feed) {
    return NextResponse.json({ error: '피드 없음' }, { status: 404 })
  }

  // 첫 페이지는 CDN 캐시 허용, 이후 페이지는 항상 신선한 데이터
  const cacheControl = offset === 0
    ? 'public, s-maxage=60, stale-while-revalidate=300'
    : 'no-store'

  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': cacheControl,
      'X-Robots-Tag': 'noindex',
    },
  })
}
