/**
 * 유저 페르소나 피드 쿼리
 * user_videos 테이블에서 조회 — 기존 FeedResponse 형식과 호환
 */
import { createClient } from '@supabase/supabase-js'
import type { FeedResponse, Video } from '@/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/** 유저 페르소나 피드 페이지네이션 */
export async function getPaginatedUserFeed(
  personaId: string,
  offset: number,
  limit: number,
): Promise<FeedResponse | null> {
  const supabase = getSupabase()

  // 페르소나 존재 + 공개 확인
  const { data: persona } = await supabase
    .from('user_personas')
    .select('persona_id, name_i18n, video_count')
    .eq('persona_id', personaId)
    .eq('is_public', true)
    .eq('is_banned', false)
    .maybeSingle()

  if (!persona) return null

  const { data: videos, error } = await supabase
    .from('user_videos')
    .select('*')
    .eq('persona_id', personaId)
    .order('added_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return null

  const rows = (videos ?? []) as Array<{
    id: number
    persona_id: string
    video_id: string
    title: string
    channel: string
    thumbnail_url: string
    user_intro: Record<string, string> | null
    added_at: string
  }>

  // 기존 Video 타입으로 매핑 (user_intro → summary_i18n 역할)
  const mappedVideos: Video[] = rows.map(row => ({
    video_id: row.video_id,
    persona_id: row.persona_id,
    title: row.title,
    channel: row.channel,
    url: `https://www.youtube.com/watch?v=${row.video_id}`,
    thumbnail_url: row.thumbnail_url,
    view_count: 0,
    keyword: '',
    score: 0,
    collected_at: row.added_at,
    feed_source: 'user',
    collected_date: row.added_at.split('T')[0] ?? null,
    published_at: null,
    titles_i18n: { ko: row.title, en: row.title, ja: row.title },
    summary_i18n: row.user_intro ?? null,
  }))

  const nameI18n = persona.name_i18n as Record<string, string>
  const personaName = nameI18n?.ko ?? nameI18n?.en ?? personaId

  return {
    persona_id: personaId,
    persona_name: personaName,
    total_accumulated: persona.video_count as number,
    dates: [
      {
        date: new Date().toISOString().split('T')[0],
        feed_source: 'user',
        videos: mappedVideos,
      },
    ],
  }
}
