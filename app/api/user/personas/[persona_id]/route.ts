import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'

type Params = { params: Promise<{ persona_id: string }> }

/** PATCH /api/user/personas/[persona_id] — 이름/소개 수정 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { persona_id } = await params
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const supabase = await createAuthClient()

  // 본인 소유 확인
  const { data: existing } = await supabase
    .from('user_personas')
    .select('user_id')
    .eq('persona_id', persona_id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: '페르소나 없음' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const updateFields: Record<string, unknown> = {}
  if (body.name_i18n) updateFields.name_i18n = body.name_i18n
  if (body.description_i18n !== undefined) updateFields.description_i18n = body.description_i18n
  if (body.is_public !== undefined) updateFields.is_public = body.is_public

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: '수정할 항목 없음' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_personas')
    .update(updateFields)
    .eq('persona_id', persona_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ persona: data })
}

/** DELETE /api/user/personas/[persona_id] — 페르소나 삭제 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { persona_id } = await params
  const supabaseAuth = await createAuthClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const supabase = await createAuthClient()

  const { data: existing } = await supabase
    .from('user_personas')
    .select('user_id')
    .eq('persona_id', persona_id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: '페르소나 없음' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { error } = await supabase
    .from('user_personas')
    .delete()
    .eq('persona_id', persona_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
