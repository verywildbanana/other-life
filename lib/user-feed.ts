/**
 * 유저 페르소나 피드 쿼리
 * user_videos 테이블에서 조회 — FeedPageResponse(플랫 videos 리스트) 형식으로 반환
 * FeedView 클라이언트가 data.videos를 기대하므로 FeedResponse(dates 배열)가 아닌 FeedPageResponse 사용
 */
import { createClient } from '@supabase/supabase-js'
import type { FeedPageResponse, Video } from '@/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/** 유저 페르소나 피드 페이지네이션 — FeedPageResponse 반환 */
export async function getPaginatedUserFeed(
  personaId: string,
  offset: number,
  limit: number,
): Promise<FeedPageResponse | null> {
  const supabase = getSupabase()

  // 페르소나 존재 확인 (is_banned 필터는 어드민 기능에서 별도 처리)
  const { data: persona, error: personaError } = await supabase
    .from('user_personas')
    .select('persona_id, name_i18n, video_count')
    .eq('persona_id', personaId)
    .maybeSingle()

  if (personaError) {
    console.error('[user-feed] persona query error:', personaError.message)
    return null
  }
  if (!persona) return null

  // id DESC 정렬 — bigserial PK라 항상 존재 (collected_at 컬럼명 의존 제거)
  const { data: videos, error } = await supabase
    .from('user_videos')
    .select('*')
    .eq('persona_id', personaId)
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[user-feed] query error:', error.message)
    return null
  }

  const rows = (videos ?? []) as Array<{
    id: number
    persona_id: string
    video_id: string
    title: string
    channel: string
    thumbnail_url: string
    user_intro: Record<string, string> | null
    titles_i18n: Record<string, string> | null
    added_at?: string
  }>

  const mappedVideos: Video[] = rows.map(row => {
    const ts = row.added_at ?? new Date().toISOString()
    // titles_i18n이 있으면 우선 사용, 없으면 원본 title로 3개 언어 채움
    const titlesI18n = row.titles_i18n ?? { ko: row.title, en: row.title, ja: row.title }
    return {
      video_id: row.video_id,
      persona_id: row.persona_id,
      title: row.title,
      channel: row.channel,
      url: `https://www.youtube.com/watch?v=${row.video_id}`,
      thumbnail_url: row.thumbnail_url,
      view_count: 0,
      keyword: '',
      score: 0,
      collected_at: ts,
      feed_source: 'user',
      collected_date: ts.split('T')[0] ?? null,
      published_at: null,
      titles_i18n: titlesI18n,
      summary_i18n: row.user_intro ?? null,
      db_id: row.id,
    }
  })

  const nameI18n = persona.name_i18n as Record<string, string>
  const personaName = nameI18n?.ko ?? nameI18n?.en ?? personaId
  const videoCount = (persona.video_count as number) ?? 0

  return {
    persona_id: personaId,
    persona_name: personaName,
    total_accumulated: videoCount,
    videos: mappedVideos,
    has_more: offset + rows.length < videoCount,
    next_offset: offset + rows.length,
  }
}
