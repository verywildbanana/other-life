import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'

/** POST /api/user/profile — 온보딩 시 닉네임 + 약관 동의 저장 */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { nickname, tos_agreed } = body as { nickname: string; tos_agreed: boolean }

  if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
    return NextResponse.json({ error: '닉네임은 2~20자 사이여야 합니다.' }, { status: 400 })
  }
  if (!tos_agreed) {
    return NextResponse.json({ error: '이용약관에 동의해주세요.' }, { status: 400 })
  }

  const supabase = await createAuthClient()

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        nickname: nickname.trim(),
        tos_agreed: true,
      },
      { onConflict: 'id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data }, { status: 201 })
}

/** PATCH /api/user/profile — terms_version 업데이트 */
export async function PATCH(req: NextRequest) {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { terms_version } = body as { terms_version: number }
  if (typeof terms_version !== 'number') {
    return NextResponse.json({ error: 'terms_version required' }, { status: 400 })
  }

  const supabase = await createAuthClient()
  const now = new Date().toISOString()

  // row 존재 여부 확인
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    // 기존 row: terms 필드만 UPDATE
    const { error } = await supabase
      .from('user_profiles')
      .update({ terms_version, terms_agreed_at: now })
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // 신규 row: nickname은 이메일 앞부분으로 채움
    const fallbackNickname = (user.email ?? '').split('@')[0].slice(0, 20) || 'user'
    const { error } = await supabase
      .from('user_profiles')
      .insert({ id: user.id, terms_version, terms_agreed_at: now, tos_agreed: true, nickname: fallbackNickname })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** GET /api/user/profile — 내 프로필 조회 */
export async function GET() {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const supabase = await createAuthClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
