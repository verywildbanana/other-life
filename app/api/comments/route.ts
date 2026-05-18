import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/** GET /api/comments?persona_id=xxx — 공개 댓글 목록 (인증 불필요) */
export async function GET(req: NextRequest) {
  const persona_id = req.nextUrl.searchParams.get('persona_id')
  if (!persona_id) return NextResponse.json({ error: 'persona_id required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('comments')
    .select('id, persona_id, user_id, parent_id, content, nickname, created_at')
    .eq('persona_id', persona_id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 댓글(parent_id=null) 목록에 replies 배열 중첩
  const comments = (data ?? []).filter(c => c.parent_id === null)
  const replies = (data ?? []).filter(c => c.parent_id !== null)

  const result = comments.slice(0, 50).map(c => ({
    ...c,
    replies: replies.filter(r => r.parent_id === c.id),
  }))

  return NextResponse.json({ comments: result })
}

/** POST /api/comments — 댓글 또는 답글 작성 (인증 필수) */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { persona_id, content, parent_id } = body as {
    persona_id: string
    content: string
    parent_id?: number | null
  }

  if (!persona_id || !content?.trim()) {
    return NextResponse.json({ error: 'persona_id and content are required' }, { status: 400 })
  }
  if (content.trim().length > 500) {
    return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 답글이면 페르소나 오너인지 검증
  if (parent_id != null) {
    const { data: persona } = await supabase
      .from('user_personas')
      .select('user_id')
      .eq('persona_id', persona_id)
      .maybeSingle()

    if (!persona || persona.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the feed owner can reply to comments' }, { status: 403 })
    }
  }

  // Rate Limit: 1분 내 5회 초과 차단
  const RATE_WINDOW_MS = 60 * 1000
  const RATE_LIMIT = 5
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count: recentCount } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)

  if ((recentCount ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'You\'re commenting too fast. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  // 닉네임 조회 (user_profiles)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle()

  const nickname = profile?.nickname ?? 'user'

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      persona_id,
      user_id: user.id,
      parent_id: parent_id ?? null,
      content: content.trim(),
      nickname,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment }, { status: 201 })
}
