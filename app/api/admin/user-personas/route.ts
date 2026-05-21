import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendInactivePersonaWarning } from '@/lib/resend'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

/** GET /api/admin/user-personas — 전체 유저 페르소나 목록 + 마지막 업데이트 */
export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: personas, error } = await supabase
    .from('user_personas')
    .select('persona_id, user_id, name_i18n, video_count, created_at, is_public')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 페르소나별 마지막 영상 추가 시각
  const personaIds = (personas ?? []).map(p => p.persona_id as string)
  const { data: latestVideos } = await supabase
    .from('user_videos')
    .select('persona_id, created_at')
    .in('persona_id', personaIds)
    .order('created_at', { ascending: false })

  // persona_id → 가장 최근 created_at
  const latestMap: Record<string, string> = {}
  for (const row of latestVideos ?? []) {
    const pid = row.persona_id as string
    if (!latestMap[pid]) latestMap[pid] = row.created_at as string
  }

  const now = Date.now()
  const WEEK_MS = 7 * 24 * 3600 * 1000

  const result = (personas ?? []).map(p => {
    const lastUpdate = latestMap[p.persona_id as string] ?? (p.created_at as string)
    const daysSince = Math.floor((now - new Date(lastUpdate).getTime()) / 86400_000)
    return {
      persona_id: p.persona_id,
      user_id: p.user_id,
      name: (p.name_i18n as Record<string, string>)?.ko ?? p.persona_id,
      video_count: p.video_count ?? 0,
      last_updated: lastUpdate,
      days_since_update: daysSince,
      is_inactive: now - new Date(lastUpdate).getTime() > WEEK_MS,
      is_public: p.is_public,
    }
  })

  return NextResponse.json({ personas: result })
}

const ADMIN_USER_ID = '744b2031-b01a-4b8b-8535-aa40b8f138c4' // verywildbanana@gmail.com
const PERSONA_ID_PREFIX = 'u_'

function generatePersonaId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${PERSONA_ID_PREFIX}${hex}`
}

/** POST /api/admin/user-personas — 이메일 발송, 페르소나 삭제, 또는 어드민 피드 생성 */
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { action: 'notify' | 'delete' | 'create'; persona_id?: string; name_i18n?: Record<string, string>; description_i18n?: Record<string, string> }
  const { action, persona_id } = body
  const supabase = createServiceClient()

  // ── CREATE: 어드민 전용 유저 피드 생성 (갯수 제한 없음) ──────────────────
  if (action === 'create') {
    const { name_i18n, description_i18n } = body
    if (!name_i18n?.ko || name_i18n.ko.trim().length < 2) {
      return NextResponse.json({ error: '한국어 이름은 2자 이상 필요합니다.' }, { status: 400 })
    }

    // 이름 중복 체크
    const { data: nameConflict } = await supabase
      .from('user_personas')
      .select('persona_id')
      .ilike('name_i18n->>ko', name_i18n.ko.trim())
      .maybeSingle()

    if (nameConflict) {
      return NextResponse.json({ error: 'NAME_TAKEN' }, { status: 409 })
    }

    // ID 충돌 방지 (최대 3회 재시도)
    let newPersonaId = generatePersonaId()
    for (let i = 0; i < 3; i++) {
      const { data: existing } = await supabase
        .from('user_personas')
        .select('persona_id')
        .eq('persona_id', newPersonaId)
        .maybeSingle()
      if (!existing) break
      newPersonaId = generatePersonaId()
    }

    const { data, error } = await supabase
      .from('user_personas')
      .insert({
        user_id: ADMIN_USER_ID,
        persona_id: newPersonaId,
        name_i18n: {
          ko: name_i18n.ko.trim(),
          en: name_i18n.en?.trim() || name_i18n.ko.trim(),
          ja: name_i18n.ja?.trim() || name_i18n.ko.trim(),
        },
        description_i18n: description_i18n ?? {},
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ persona: data }, { status: 201 })
  }

  const { data: persona } = await supabase
    .from('user_personas')
    .select('user_id, name_i18n, persona_id')
    .eq('persona_id', persona_id!)
    .maybeSingle()

  if (!persona) return NextResponse.json({ error: '페르소나 없음' }, { status: 404 })

  const personaName = (persona.name_i18n as Record<string, string>)?.ko ?? persona_id!

  if (action === 'notify') {
    const { data: userData } = await supabase.auth.admin.getUserById(persona.user_id as string)
    const email = userData?.user?.email
    if (!email) return NextResponse.json({ error: '이메일 없음' }, { status: 404 })

    // 마지막 업데이트 계산
    const { data: latest } = await supabase
      .from('user_videos')
      .select('created_at')
      .eq('persona_id', persona_id!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastUpdate = latest?.created_at ?? persona.persona_id
    const daysSince = Math.floor((Date.now() - new Date(lastUpdate as string).getTime()) / 86400_000)

    await sendInactivePersonaWarning({ toEmail: email, personaName, personaId: persona_id!, daysSinceUpdate: daysSince })
    return NextResponse.json({ ok: true, sent_to: email })
  }

  if (action === 'delete') {
    const { error } = await supabase.from('user_personas').delete().eq('persona_id', persona_id!)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
