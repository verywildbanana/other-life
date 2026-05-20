import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'

const MAX_PERSONAS = 3
const PERSONA_ID_PREFIX = 'u_'

/** u_{6자 랜덤 hex} 형태 ID 생성 */
function generatePersonaId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${PERSONA_ID_PREFIX}${hex}`
}

/** GET /api/user/personas — 내 페르소나 목록 */
export async function GET() {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const supabase = await createAuthClient()
  const { data, error } = await supabase
    .from('user_personas')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ personas: data })
}

/** POST /api/user/personas — 페르소나 생성 */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const supabase = await createAuthClient()

  // 온보딩 완료 + 밴 여부 확인
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tos_agreed, is_banned')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.tos_agreed) {
    return NextResponse.json(
      { error: 'ONBOARDING_REQUIRED' },
      { status: 403 },
    )
  }
  if (profile.is_banned) {
    return NextResponse.json(
      { error: 'ACCOUNT_BANNED' },
      { status: 403 },
    )
  }

  // 페르소나 수 제한 확인
  const { count, error: countError } = await supabase
    .from('user_personas')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((count ?? 0) >= MAX_PERSONAS) {
    return NextResponse.json(
      { error: `You can create up to ${MAX_PERSONAS} feeds.` },
      { status: 400 },
    )
  }

  const body = await req.json()
  const { name_i18n, description_i18n } = body as {
    name_i18n: Record<string, string>
    description_i18n: Record<string, string>
  }

  // 이름 검증
  if (!name_i18n?.ko || name_i18n.ko.trim().length < 2) {
    return NextResponse.json({ error: 'Korean name must be at least 2 characters.' }, { status: 400 })
  }

  // 전체 서비스 이름 중복 체크 (ko 기준, 대소문자·공백 무시)
  const { data: nameConflict } = await supabase
    .from('user_personas')
    .select('persona_id')
    .ilike('name_i18n->>ko', name_i18n.ko.trim())
    .maybeSingle()

  if (nameConflict) {
    return NextResponse.json(
      { error: 'NAME_TAKEN' },
      { status: 409 },
    )
  }

  // 충돌 방지: 최대 3회 재시도
  let personaId = generatePersonaId()
  for (let i = 0; i < 3; i++) {
    const { data: existing } = await supabase
      .from('user_personas')
      .select('persona_id')
      .eq('persona_id', personaId)
      .maybeSingle()
    if (!existing) break
    personaId = generatePersonaId()
  }

  const { data, error } = await supabase
    .from('user_personas')
    .insert({
      user_id: user.id,
      persona_id: personaId,
      name_i18n,
      description_i18n: description_i18n ?? {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ persona: data }, { status: 201 })
}
