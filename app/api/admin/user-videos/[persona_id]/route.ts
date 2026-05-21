import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ADMIN_USER_ID = '744b2031-b01a-4b8b-8535-aa40b8f138c4' // verywildbanana@gmail.com
const MAX_VIDEOS_PER_PERSONA = 500

function verifyAdmin(req: NextRequest): boolean {
  // admin_token 쿠키 또는 X-Admin-Token 헤더로 인증
  const cookieToken = req.cookies.get('admin_token')?.value
  const headerToken = req.headers.get('X-Admin-Token') ?? ''
  const expected = process.env.ADMIN_SECRET_TOKEN ?? ''
  return !!expected && (cookieToken === expected || headerToken === expected)
}

interface IngestItem {
  id: string
  title: string
  channel: string
  url?: string
  thumbnail?: string
  view_count?: number
  titles_i18n?: Record<string, string>
  summary_i18n?: Record<string, string> | null
  published_at?: string | null
}

/** POST /api/admin/user-videos/[persona_id]
 *  patch_base_user_feed.js에서 호출 — user_videos 테이블에 영상 저장
 *  인증: X-Admin-Token 헤더
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { persona_id } = await params
  const supabase = createServiceClient()

  // 페르소나 존재 + 어드민 소유 확인
  const { data: persona } = await supabase
    .from('user_personas')
    .select('persona_id, user_id, video_count')
    .eq('persona_id', persona_id)
    .maybeSingle()

  if (!persona) {
    return NextResponse.json({ error: `페르소나 없음: ${persona_id}` }, { status: 404 })
  }
  if (persona.user_id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: '어드민 소유 피드가 아닙니다.' }, { status: 403 })
  }

  const body = await req.json()
  const items: IngestItem[] = body.feed ?? []
  if (items.length === 0) {
    return NextResponse.json({ status: 'ok', saved: 0, skipped: 0, updated: 0 })
  }

  // 기존 video_id 목록 조회
  const { data: existing } = await supabase
    .from('user_videos')
    .select('video_id')
    .eq('persona_id', persona_id)

  const existingSet = new Set((existing ?? []).map(r => r.video_id as string))

  const toInsert = []
  let skipped = 0

  for (const item of items) {
    if (!item.id || item.id.length !== 11) { skipped++; continue }

    if (!existingSet.has(item.id)) {
      // 신규 영상 INSERT (DDL: id, persona_id, user_id, video_id, title, channel, thumbnail_url, user_intro, added_at)
      toInsert.push({
        persona_id,
        user_id: ADMIN_USER_ID,
        video_id: item.id,
        title: item.title,
        channel: item.channel,
        thumbnail_url: item.thumbnail ?? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        titles_i18n: item.titles_i18n ?? { ko: item.title, en: item.title, ja: item.title },
        user_intro: item.summary_i18n
          ? { ko: item.summary_i18n.ko ?? null, en: item.summary_i18n.en ?? null, ja: item.summary_i18n.ja ?? null }
          : null,
      })
    } else {
      skipped++
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('user_videos').insert(toInsert)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 500개 초과 시 오래된 것 삭제
    const { count } = await supabase
      .from('user_videos')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id)

    if ((count ?? 0) > MAX_VIDEOS_PER_PERSONA) {
      const deleteCount = (count ?? 0) - MAX_VIDEOS_PER_PERSONA
      const { data: old } = await supabase
        .from('user_videos')
        .select('video_id')
        .eq('persona_id', persona_id)
        .order('added_at', { ascending: true })
        .limit(deleteCount)

      if (old && old.length > 0) {
        await supabase
          .from('user_videos')
          .delete()
          .in('video_id', old.map(r => r.video_id as string))
      }
    }

    // video_count 캐시 직접 업데이트
    await supabase
      .from('user_personas')
      .update({ video_count: (persona.video_count ?? 0) + toInsert.length })
      .eq('persona_id', persona_id)
  }

  return NextResponse.json({
    status: 'ok',
    saved: toInsert.length,
    skipped,
  })
}
