import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('videos')
    .select('persona_id, collected_date')
    .order('collected_date', { ascending: false })

  const stats: Record<string, { total: number; latest_date: string | null }> = {}
  for (const row of data ?? []) {
    if (!stats[row.persona_id]) {
      stats[row.persona_id] = { total: 0, latest_date: row.collected_date }
    }
    stats[row.persona_id].total++
  }

  return NextResponse.json(stats)
}
