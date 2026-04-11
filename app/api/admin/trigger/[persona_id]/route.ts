import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

// 수동 수집 트리거 — Ubuntu browse_session.js가 이 큐를 확인하고 즉시 실행
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { persona_id } = await params
  const supabase = createServiceClient()

  // 이미 대기 중인 트리거가 있으면 중복 추가 방지
  const { data: existing } = await supabase
    .from('collect_triggers')
    .select('id')
    .eq('persona_id', persona_id)
    .is('picked_up_at', null)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ status: 'already_queued' })
  }

  const { error } = await supabase
    .from('collect_triggers')
    .insert({ persona_id })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'queued' })
}
