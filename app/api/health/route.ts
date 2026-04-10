import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { listPersonas } from '@/lib/personas'

export async function GET() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('videos')
    .select('collected_at')
    .order('collected_at', { ascending: false })
    .limit(1)
    .single()

  // 내부 정보 최소화 — last_ingest/personas 수는 외부 노출 제외
  return NextResponse.json({
    status: 'ok',
    db: data ? 'ok' : 'empty',
  })
}
