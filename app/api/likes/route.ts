import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/** GET /api/likes?persona_id=xxx — 좋아요 수 + 내가 눌렀는지 (인증 불필요) */
export async function GET(req: NextRequest) {
  const persona_id = req.nextUrl.searchParams.get('persona_id')
  if (!persona_id) return NextResponse.json({ error: 'persona_id required' }, { status: 400 })

  const supabase = createServiceClient()

  // 총 좋아요 수
  const { count } = await supabase
    .from('persona_likes')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', persona_id)

  // 현재 로그인 유저가 눌렀는지 확인
  let liked = false
  try {
    const supabaseAuth = await createAuthClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('persona_likes')
        .select('user_id')
        .eq('persona_id', persona_id)
        .eq('user_id', user.id)
        .maybeSingle()
      liked = !!data
    }
  } catch { /* 인증 실패 시 liked=false 유지 */ }

  return NextResponse.json({ count: count ?? 0, liked })
}

/** POST /api/likes — 좋아요 토글 (인증 필수) */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const { persona_id } = await req.json() as { persona_id: string }
  if (!persona_id) return NextResponse.json({ error: 'persona_id required' }, { status: 400 })

  const supabase = createServiceClient()

  // 이미 눌렀으면 취소, 아니면 추가
  const { data: existing } = await supabase
    .from('persona_likes')
    .select('user_id')
    .eq('persona_id', persona_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('persona_likes')
      .delete()
      .eq('persona_id', persona_id)
      .eq('user_id', user.id)
    // 취소 후 최신 카운트 반환
    const { count } = await supabase
      .from('persona_likes')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id)
    return NextResponse.json({ liked: false, count: count ?? 0 })
  } else {
    await supabase
      .from('persona_likes')
      .insert({ persona_id, user_id: user.id })
    const { count } = await supabase
      .from('persona_likes')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id)
    return NextResponse.json({ liked: true, count: count ?? 0 })
  }
}
