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
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

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
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const supabase = await createAuthClient()

  // 페르소나 수 제한 확인
  const { count, error: countError } = await supabase
    .from('user_personas')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  if ((count ?? 0) >= MAX_PERSONAS) {
    return NextResponse.json(
      { error: `페르소나는 최대 ${MAX_PERSONAS}개까지 만들 수 있습니다.` },
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
    return NextResponse.json({ error: '한국어 이름은 2자 이상 입력해주세요.' }, { status: 400 })
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
