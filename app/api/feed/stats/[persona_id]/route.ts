import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ persona_id: string }> },
) {
  const { persona_id } = await params
  const supabase = getServiceClient()

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [weeklyRes, totalRes] = await Promise.all([
    supabase
      .from('access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id)
      .gte('accessed_at', since7d),
    supabase
      .from('access_logs')
      .select('*', { count: 'exact', head: true })
      .eq('persona_id', persona_id),
  ])

  return NextResponse.json(
    {
      weekly: weeklyRes.count ?? 0,
      total: totalRes.count ?? 0,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
