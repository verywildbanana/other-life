import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/** GET /api/user/personas/owner?persona_id=xxx — 페르소나 오너 user_id 공개 조회 */
export async function GET(req: NextRequest) {
  const persona_id = req.nextUrl.searchParams.get('persona_id')
  if (!persona_id) return NextResponse.json({ error: 'persona_id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_personas')
    .select('user_id')
    .eq('persona_id', persona_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '페르소나 없음' }, { status: 404 })

  return NextResponse.json({ owner_id: data.user_id })
}
