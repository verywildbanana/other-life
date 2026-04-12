import { NextRequest, NextResponse } from 'next/server'
import { getPaginatedFeed } from '@/lib/feed'
import { logFeedAccess } from '@/lib/access-log'
import { verifyToken, COOKIE_NAME } from '@/lib/feed-token'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  // 토큰 검증 — 우리 서비스 페이지에서 발급된 세션만 허용
  const token = req.cookies.get(COOKIE_NAME)?.value
  const ua = req.headers.get('user-agent') ?? ''
  const verify = await verifyToken(token, ua)

  if (!verify.ok) {
    // 디버깅에 이유 노출 금지 — 외부에는 동일한 401만 반환
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
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

  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': 'no-store', // 토큰 인증 후 응답은 CDN 캐시 금지
      'X-Robots-Tag': 'noindex',
    },
  })
}
