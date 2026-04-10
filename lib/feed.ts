import { createServerClient } from '@/lib/supabase/server'
import { DateGroup, FeedResponse, Video } from '@/types'
import { loadPersona } from '@/lib/personas'

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

  // 각 날짜별 영상 조회
  const dates: DateGroup[] = []
  for (const [date, feedSource] of uniqueDates) {
    const { data: videos } = await supabase
      .from('videos')
      .select('*')
      .eq('persona_id', personaId)
      .eq('collected_date', date)
      .order('score', { ascending: false })

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
