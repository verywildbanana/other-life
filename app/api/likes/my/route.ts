import { NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/** GET /api/likes/my — 로그인 유저가 좋아요 누른 persona_ids 전체 반환 */
export async function GET() {
  try {
    const supabaseAuth = await createAuthClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ persona_ids: [] })

    const supabase = createServiceClient()
    const { data } = await supabase
      .from('persona_likes')
      .select('persona_id')
      .eq('user_id', user.id)

    const persona_ids = (data ?? []).map((r: { persona_id: string }) => r.persona_id)
    return NextResponse.json({ persona_ids })
  } catch {
    return NextResponse.json({ persona_ids: [] })
  }
}
