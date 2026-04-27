import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadPersona } from '@/lib/personas'
import { verifyToken, COOKIE_NAME } from '@/lib/feed-token'
import { logSuspicious } from '@/lib/suspicious'
import { Video } from '@/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  // 토큰 검증 — 우리 서비스 페이지에서 발급된 세션만 허용
  const token = req.cookies.get(COOKIE_NAME)?.value
  const ua = req.headers.get('user-agent') ?? ''
  const verify = await verifyToken(token, ua)

  if (!verify.ok) {
    const { persona_id: pid } = await params
    await logSuspicious(req, pid ?? 'unknown', verify.reason)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { persona_id } = await params
  const persona = loadPersona(persona_id)
  if (!persona) {
    return NextResponse.json({ error: '페르소나 없음' }, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const limit  = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)))

  const supabase = createServiceClient()

  // 최신순 + 점수순 정렬 — 캐로셀 왼쪽이 최신
  const { data: rows } = await supabase
    .from('shorts')
    .select('video_id, persona_id, title, channel, url, thumbnail_url, view_count, keyword, feed_source, collected_date, published_at, titles_i18n')
    .eq('persona_id', persona_id)
    .order('collected_date', { ascending: false })
    .order('score', { ascending: false })
    .range(offset, offset + limit - 1)

  const hasMore = (rows?.length ?? 0) === limit

  return NextResponse.json(
    {
      persona_id,
      persona_name: persona.name,
      videos: (rows ?? []) as unknown as Video[],
      has_more: hasMore,
      next_offset: offset + (rows?.length ?? 0),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    },
  )
}
