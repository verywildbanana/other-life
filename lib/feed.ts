import { createServiceClient } from '@/lib/supabase/server'
import { DateGroup, FeedPageResponse, FeedResponse, Video } from '@/types'
import { loadPersona } from '@/lib/personas'

// 한 번에 반환할 최대 날짜 수 (스크래핑 방지)
const MAX_DATES_PER_REQUEST = 3
// 날짜 1개당 최대 영상 수
const MAX_VIDEOS_PER_DATE = 30

// 공개 응답에서 제외할 민감 필드
type PublicVideo = Omit<Video, 'score' | 'feed_source'>

function toPublicVideo(v: Video): PublicVideo {
  const { score: _s, feed_source: _f, ...pub } = v
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

  const supabase = createServiceClient()

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

const PAGE_LIMIT = 20  // 페이지당 영상 수

// 페이지네이션 공개 API용 — 최신순 플랫 리스트, score/feed_source 제외
// skipCount=true → COUNT 쿼리 생략 (Stage 1 빠른 첫 화면용, total_accumulated=0 반환)
//   COUNT는 풀 테이블 스캔이라 비용이 크므로 첫 화면 latency를 줄이기 위해 옵션화
export async function getPaginatedFeed(
  personaId: string,
  offset: number = 0,
  limit: number = PAGE_LIMIT,
  skipCount: boolean = false,
): Promise<FeedPageResponse | null> {
  const persona = loadPersona(personaId)
  if (!persona) return null

  const supabase = createServiceClient()

  // COUNT는 옵션 — Stage 1 fetch에서는 스킵해 첫 응답 속도 개선
  let total = 0
  if (!skipCount) {
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', personaId)
    total = count ?? 0
  }

  // 두 쿼리로 분리 — epochShuffle 버킷 정확도 보장
  // 1) summary 있는 영상 전부 (limit 300)
  // 2) summary 없는 영상 최신 100개
  // → summary 영상이 limit 밖으로 밀려나는 문제 해결, 페이로드는 최대 ~400개로 제한
  const COLS = 'video_id, persona_id, title, channel, url, thumbnail_url, collected_date, collected_at, published_at, titles_i18n, summary_i18n'

  const [withSummaryRes, noSummaryRes] = await Promise.all([
    supabase
      .from('videos')
      .select(COLS)
      .eq('persona_id', personaId)
      .not('summary_i18n', 'is', null)
      .order('collected_date', { ascending: false })
      .order('score', { ascending: false })
      .limit(300),
    supabase
      .from('videos')
      .select(COLS)
      .eq('persona_id', personaId)
      .is('summary_i18n', null)
      .order('collected_date', { ascending: false })
      .order('score', { ascending: false })
      .limit(100),
  ])

  const rows = [...(withSummaryRes.data ?? []), ...(noSummaryRes.data ?? [])]
  if (rows.length === 0) return null

  return {
    persona_id: personaId,
    persona_name: persona.name,
    total_accumulated: total,
    videos: rows as unknown as Video[],
    has_more: false,   // 전체 일괄 로드 — 클라이언트 epochShuffle이 무한스크롤 담당
    next_offset: rows.length,
  }
}
