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

// titles_i18n에 실제 번역이 있는지 판단
// en 필드가 한국어 원문(ko와 동일)이거나 ko/ja가 비어있으면 "번역 없음"으로 판정
function hasMeaningfulTitles(titles: Record<string, string> | null | undefined): boolean {
  if (!titles) return false
  const { en = '', ko = '', ja = '' } = titles
  // ko, ja 둘 다 비어있으면 번역 없음
  if (!ko && !ja) return false
  // en이 ko와 동일하면 번역되지 않은 fallback
  if (en && ko && en === ko) return false
  return true
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
    return NextResponse.json({ status: 'ok', saved: 0, skipped: 0, updated: 0 })
  }

  const supabase = createServiceClient()

  // 기존 video_id + 현재 번역/요약 상태 조회
  const { data: existing } = await supabase
    .from('videos')
    .select('video_id, titles_i18n, summary_i18n')
    .eq('persona_id', persona_id)

  // video_id → {titles_i18n, summary_i18n} 맵
  const existingMap = new Map(
    (existing ?? []).map((r: { video_id: string; titles_i18n: Record<string, string> | null; summary_i18n: Record<string, string> | null }) =>
      [r.video_id, { titles_i18n: r.titles_i18n, summary_i18n: r.summary_i18n }]
    )
  )

  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const toInsert = []
  const toUpdate: { video_id: string; titles_i18n?: Record<string, string>; summary_i18n?: Record<string, string> }[] = []
  let skipped = 0

  for (const item of items) {
    if (!item.id || item.id.length !== 11) { skipped++; continue }

    const existing_row = existingMap.get(item.id)

    if (!existing_row) {
      // 신규 영상 → INSERT
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
        published_at: item.published_at ?? null,
        titles_i18n: item.titles_i18n ?? {},
        summary_i18n: item.summary_i18n ?? null,
      })
      continue
    }

    // 기존 영상 — 번역/요약이 비어있을 때만 보강 UPDATE
    const needsTitleUpdate = !hasMeaningfulTitles(existing_row.titles_i18n) && hasMeaningfulTitles(item.titles_i18n)
    const needsSummaryUpdate = !existing_row.summary_i18n && item.summary_i18n

    if (needsTitleUpdate || needsSummaryUpdate) {
      const patch: { video_id: string; titles_i18n?: Record<string, string>; summary_i18n?: Record<string, string> } = { video_id: item.id }
      if (needsTitleUpdate) patch.titles_i18n = item.titles_i18n
      if (needsSummaryUpdate) patch.summary_i18n = item.summary_i18n
      toUpdate.push(patch)
    } else {
      skipped++
    }
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

  // 보강 UPDATE — 각 영상별로 변경된 필드만 업데이트
  for (const patch of toUpdate) {
    const { video_id, ...fields } = patch
    await supabase
      .from('videos')
      .update(fields)
      .eq('video_id', video_id)
      .eq('persona_id', persona_id)
  }

  // 변경사항이 있으면 ISR 캐시 무효화
  if (toInsert.length > 0 || toUpdate.length > 0) {
    revalidatePath(`/p/${persona_id}`)
  }

  return NextResponse.json({ status: 'ok', saved: toInsert.length, updated: toUpdate.length, skipped })
}
