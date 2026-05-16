import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'

type Params = { params: Promise<{ video_id: string }> }

/** DELETE /api/user/videos/[video_id] — 영상 삭제 (video_id = DB row id) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { video_id } = await params
  const rowId = parseInt(video_id, 10)
  if (isNaN(rowId)) return NextResponse.json({ error: '잘못된 ID' }, { status: 400 })

  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data: existing } = await supabase
    .from('user_videos')
    .select('user_id')
    .eq('id', rowId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: '영상 없음' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { error } = await supabase.from('user_videos').delete().eq('id', rowId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** PATCH /api/user/videos/[video_id] — 소개 텍스트 수정 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { video_id } = await params
  const rowId = parseInt(video_id, 10)
  if (isNaN(rowId)) return NextResponse.json({ error: '잘못된 ID' }, { status: 400 })

  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { user_intro } = body as { user_intro: Record<string, string> | null }

  const { data: existing } = await supabase
    .from('user_videos')
    .select('user_id')
    .eq('id', rowId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: '영상 없음' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabase
    .from('user_videos')
    .update({ user_intro })
    .eq('id', rowId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ video: data })
}
