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

  return NextResponse.json({
    status: 'ok',
    db: 'ok',
    last_ingest: data?.collected_at ?? null,
    personas: listPersonas().length,
  })
}
