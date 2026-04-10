import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { loadPersona } from '@/lib/personas'
import { IngestItem } from '@/types'

const MAX_VIDEOS_PER_PERSONA = 500

function scoreVideo(title: string, channel: string, persona: { keywords?: string[] }): number {
  // Python scoring/engine.py 로직 이식 (키워드 매칭 기반)
  const keywords = persona.keywords ?? []
  const text = `${title} ${channel}`.toLowerCase()
  let score = 10 // 기본 점수

  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) score += 20
  }

  return Math.min(score, 100)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  // X-API-Key 인증
  const apiKey = req.headers.get('X-API-Key') ?? ''
  const expectedKey = process.env.INGEST_API_KEY ?? ''
  if (expectedKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { persona_id } = await params
  const persona = loadPersona(persona_id)
  if (!persona) {
    return NextResponse.json({ error: `페르소나 없음: ${persona_id}` }, { status: 404 })
  }

  const body = await req.json()
  const items: IngestItem[] = body.feed ?? []
  if (items.length === 0) {
    return NextResponse.json({ status: 'ok', saved: 0, skipped: 0 })
  }

  const supabase = createServiceClient()

  // 기존 video_id 조회
  const { data: existing } = await supabase
    .from('videos')
    .select('video_id')
    .eq('persona_id', persona_id)

  const existingIds = new Set((existing ?? []).map((r: { video_id: string }) => r.video_id))
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const toInsert = []
  let skipped = 0

  for (const item of items) {
    if (!item.id || item.id.length !== 11) { skipped++; continue }
    if (existingIds.has(item.id)) { skipped++; continue }

    toInsert.push({
      video_id: item.id,
      persona_id,
      title: item.title,
      channel: item.channel,
      url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
      thumbnail_url: item.thumbnail ?? '',
      view_count: item.view_count ?? 0,
      keyword: 'home_feed',
      score: scoreVideo(item.title, item.channel, persona as { keywords?: string[] }),
      collected_at: now,
      feed_source: 'home_feed',
      collected_date: today,
      titles_i18n: item.titles_i18n ?? {},
    })
  }

  if (toInsert.length > 0) {
    await supabase.from('videos').insert(toInsert)

    // 500개 초과 시 오래된 것 삭제
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id)

    if ((count ?? 0) > MAX_VIDEOS_PER_PERSONA) {
      const deleteCount = (count ?? 0) - MAX_VIDEOS_PER_PERSONA
      const { data: old } = await supabase
        .from('videos')
        .select('video_id')
        .eq('persona_id', persona_id)
        .order('collected_at', { ascending: true })
        .limit(deleteCount)

      if (old && old.length > 0) {
        await supabase
          .from('videos')
          .delete()
          .in('video_id', old.map((r: { video_id: string }) => r.video_id))
      }
    }
  }

  // 새 영상이 저장됐으면 해당 페이지 ISR 캐시 즉시 무효화
  if (toInsert.length > 0) {
    revalidatePath(`/p/${persona_id}`)
  }

  return NextResponse.json({ status: 'ok', saved: toInsert.length, skipped })
}
