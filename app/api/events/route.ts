import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyToken, COOKIE_NAME } from '@/lib/feed-token'
import { getClientIp, hashIp } from '@/lib/rate-limit'

interface EventPayload {
  type: 'video_click' | 'scroll_load' | 'shorts_click'
  persona_id: string
  video_id?: string
  position?: number      // 피드 내 위치 (1-based)
  scroll_page?: number   // 몇 번째 배치 (1-based)
  lang?: string
}

export async function POST(req: NextRequest) {
  // feed_token 인증 — 우리 서비스 페이지에서 온 요청만 허용
  const token = req.cookies.get(COOKIE_NAME)?.value
  const ua = req.headers.get('user-agent') ?? ''
  const verify = await verifyToken(token, ua)
  if (!verify.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // 배치당 최대 50개로 제한 (과도한 요청 방지)
  const events: EventPayload[] = body.events.slice(0, 50)

  const session_id = verify.payload!.id  // feed_token의 UUID
  const country = req.headers.get('x-vercel-ip-country') ?? null
  const ip_hash = hashIp(getClientIp(req))

  const rows = events
    .filter((e) => e.type && e.persona_id)
    .map((e) => ({
      session_id,
      persona_id: e.persona_id,
      event_type: e.type,
      video_id: e.video_id ?? null,
      position: e.position ?? null,
      scroll_page: e.scroll_page ?? null,
      lang: e.lang ?? null,
      country,
      ip_hash,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ status: 'ok', inserted: 0 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('events').insert(rows)

  if (error) {
    // events 테이블이 아직 없는 경우 — 조용히 실패 (UX 영향 없음)
    console.warn('[events] insert error:', error.message)
    return NextResponse.json({ status: 'ok', inserted: 0 })
  }

  return NextResponse.json({ status: 'ok', inserted: rows.length })
}
