import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadPersona } from '@/lib/personas'
import { IngestItem } from '@/types'

const MAX_SHORTS_PER_PERSONA = 200

function scoreVideo(title: string, channel: string, persona: { keywords?: string[] }): number {
  const keywords = persona.keywords ?? []
  const text = `${title} ${channel}`.toLowerCase()
  let score = 10

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
    .from('shorts')
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
      // shorts URL 포맷 강제
      url: `https://www.youtube.com/shorts/${item.id}`,
      thumbnail_url: item.thumbnail ?? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      view_count: item.view_count ?? 0,
      keyword: item.keyword ?? 'shorts_search',
      score: scoreVideo(item.title, item.channel, persona as { keywords?: string[] }),
      collected_at: now,
      feed_source: 'shorts_search',
      collected_date: today,
      published_at: item.published_at ?? null,
      titles_i18n: item.titles_i18n ?? {},
    })
  }

  if (toInsert.length > 0) {
    await supabase.from('shorts').insert(toInsert)

    // 200개 초과 시 오래된 것 삭제
    const { count } = await supabase
      .from('shorts')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id)

    if ((count ?? 0) > MAX_SHORTS_PER_PERSONA) {
      const deleteCount = (count ?? 0) - MAX_SHORTS_PER_PERSONA
      const { data: old } = await supabase
        .from('shorts')
        .select('video_id')
        .eq('persona_id', persona_id)
        .order('collected_at', { ascending: true })
        .limit(deleteCount)

      if (old && old.length > 0) {
        await supabase
          .from('shorts')
          .delete()
          .in('video_id', old.map((r: { video_id: string }) => r.video_id))
      }
    }
  }

  return NextResponse.json({ status: 'ok', saved: toInsert.length, skipped })
}
