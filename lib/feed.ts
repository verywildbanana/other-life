import { createServerClient } from '@/lib/supabase/server'
import { DateGroup, FeedResponse, Video } from '@/types'
import { loadPersona } from '@/lib/personas'

// 한 번에 반환할 최대 날짜 수 (스크래핑 방지)
const MAX_DATES_PER_REQUEST = 3
// 날짜 1개당 최대 영상 수
const MAX_VIDEOS_PER_DATE = 30

// 공개 응답에서 제외할 민감 필드
type PublicVideo = Omit<Video, 'score' | 'collected_at' | 'feed_source'>

function toPublicVideo(v: Video): PublicVideo {
  const { score: _s, collected_at: _c, feed_source: _f, ...pub } = v
  return pub
}

export interface FeedResponsePublic {
  persona_id: string
  persona_name: string
  total_accumulated: number
  dates: { date: string; videos: PublicVideo[] }[]
}

export async function getFeedByPersona(personaId: string): Promise<FeedResponse | null> {
  const persona = loadPersona(personaId)
  if (!persona) return null

  const supabase = createServerClient()

  // 날짜 목록 조회
  const { data: dateRows, error } = await supabase
    .from('videos')
    .select('collected_date, feed_source')
    .eq('persona_id', personaId)
    .not('collected_date', 'is', null)
    .order('collected_date', { ascending: false })

  if (error || !dateRows || dateRows.length === 0) return null

  // 날짜별로 그룹화 (home_feed 우선)
  const dateMap = new Map<string, string>()
  for (const row of dateRows) {
    const existing = dateMap.get(row.collected_date)
    if (!existing || row.feed_source === 'home_feed') {
      dateMap.set(row.collected_date, row.feed_source)
    }
  }

  const uniqueDates = Array.from(dateMap.entries()).sort((a, b) =>
    b[0].localeCompare(a[0]),
  )

  // 각 날짜별 영상 조회 (최근 MAX_DATES_PER_REQUEST일치만)
  const dates: DateGroup[] = []
  for (const [date, feedSource] of uniqueDates.slice(0, MAX_DATES_PER_REQUEST)) {
    const { data: videos } = await supabase
      .from('videos')
      .select('*')
      .eq('persona_id', personaId)
      .eq('collected_date', date)
      .order('score', { ascending: false })
      .limit(MAX_VIDEOS_PER_DATE)

    if (videos && videos.length > 0) {
      dates.push({ date, feed_source: feedSource, videos: videos as Video[] })
    }
  }

  if (dates.length === 0) return null

  const { count } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', personaId)

  return {
    persona_id: personaId,
    persona_name: persona.name,
    total_accumulated: count ?? 0,
    dates,
  }
}

// 공개 API용 — score/collected_at/feed_source 제외
export async function getPublicFeed(personaId: string): Promise<FeedResponsePublic | null> {
  const feed = await getFeedByPersona(personaId)
  if (!feed) return null

  return {
    persona_id: feed.persona_id,
    persona_name: feed.persona_name,
    total_accumulated: feed.total_accumulated,
    dates: feed.dates.map(d => ({
      date: d.date,
      videos: d.videos.map(toPublicVideo),
    })),
  }
}
