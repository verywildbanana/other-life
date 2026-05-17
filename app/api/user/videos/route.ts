import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'

const MAX_VIDEOS = 500
const RATE_LIMIT_MS = 60_000
const RATE_LIMIT_MAX = 10  // 분당 10개

/** YouTube video ID 추출 (다양한 URL 형식 지원) */
function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,  // 직접 ID
  ]
  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/** YouTube oEmbed API로 메타데이터 조회 */
async function fetchOEmbed(videoId: string): Promise<{ title: string; author_name: string; thumbnail_url: string } | null> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json() as { title?: string; author_name?: string; thumbnail_url?: string }
    if (!data.title) return null
    return {
      title: data.title,
      author_name: data.author_name ?? '',
      thumbnail_url: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    }
  } catch {
    return null
  }
}

/** POST /api/user/videos — 유저 피드에 YouTube 영상 추가 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { persona_id, url: videoUrl, user_intro, titles_i18n } = body as {
    persona_id: string
    url: string
    user_intro?: Record<string, string>
    titles_i18n?: Record<string, string>
  }

  if (!persona_id?.startsWith('u_')) {
    return NextResponse.json({ error: '유효하지 않은 페르소나 ID' }, { status: 400 })
  }
  if (!videoUrl) {
    return NextResponse.json({ error: 'YouTube URL을 입력해주세요.' }, { status: 400 })
  }

  const videoId = extractVideoId(videoUrl.trim())
  if (!videoId) {
    return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 })
  }

  // 페르소나 본인 소유 + 500개 제한 확인
  const { data: persona } = await supabase
    .from('user_personas')
    .select('user_id, video_count')
    .eq('persona_id', persona_id)
    .maybeSingle()

  if (!persona) return NextResponse.json({ error: '페르소나 없음' }, { status: 404 })
  if (persona.user_id !== user.id) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  if ((persona.video_count as number) >= MAX_VIDEOS) {
    return NextResponse.json(
      { error: `영상은 최대 ${MAX_VIDEOS}개까지 추가할 수 있습니다. 오래된 영상을 먼저 삭제해주세요.` },
      { status: 400 },
    )
  }

  // Rate Limit: 분당 10개 (access_logs 기반 대신 user_videos 삽입 시도 횟수)
  const since = new Date(Date.now() - RATE_LIMIT_MS).toISOString()
  const { count: recentCount } = await supabase
    .from('user_videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('added_at', since)

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: '너무 빠르게 추가하고 있습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  // 중복 확인
  const { data: existing } = await supabase
    .from('user_videos')
    .select('id')
    .eq('persona_id', persona_id)
    .eq('video_id', videoId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '이미 추가된 영상입니다.' }, { status: 409 })
  }

  // oEmbed로 메타데이터 조회
  const meta = await fetchOEmbed(videoId)
  if (!meta) {
    return NextResponse.json({ error: '영상 정보를 가져올 수 없습니다. 공개된 영상인지 확인해주세요.' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('user_videos')
    .insert({
      persona_id,
      user_id: user.id,
      video_id: videoId,
      title: meta.title,
      channel: meta.author_name,
      thumbnail_url: meta.thumbnail_url,
      user_intro: user_intro ?? null,
      titles_i18n: titles_i18n ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ video: data }, { status: 201 })
}
