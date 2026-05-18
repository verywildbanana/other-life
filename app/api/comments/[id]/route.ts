import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/** DELETE /api/comments/[id] — 본인 댓글 또는 페르소나 오너가 삭제 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const commentId = parseInt(id, 10)
  if (isNaN(commentId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const supabase = createServiceClient()

  // 댓글 조회
  const { data: comment } = await supabase
    .from('comments')
    .select('id, user_id, persona_id')
    .eq('id', commentId)
    .maybeSingle()

  if (!comment) return NextResponse.json({ error: '댓글 없음' }, { status: 404 })

  // 본인 댓글이면 바로 삭제
  if (comment.user_id === user.id) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 페르소나 오너인지 확인
  const { data: persona } = await supabase
    .from('user_personas')
    .select('user_id')
    .eq('persona_id', comment.persona_id)
    .maybeSingle()

  if (persona?.user_id === user.id) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '권한 없음' }, { status: 403 })
}
