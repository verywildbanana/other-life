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

  // 접근 로그 통계 (최근 7일)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: logRows } = await supabase
    .from('access_logs')
    .select('persona_id, country, accessed_at')
    .gte('accessed_at', since7d)
    .order('accessed_at', { ascending: false })

  // 페르소나별 접근 수 집계
  const accessByPersona: Record<string, number> = {}
  const countryCount: Record<string, number> = {}
  const dailyCount: Record<string, number> = {}

  for (const row of logRows ?? []) {
    accessByPersona[row.persona_id] = (accessByPersona[row.persona_id] ?? 0) + 1
    if (row.country) countryCount[row.country] = (countryCount[row.country] ?? 0) + 1
    const day = (row.accessed_at as string).slice(0, 10)
    dailyCount[day] = (dailyCount[day] ?? 0) + 1
  }

  const accessLogs = {
    total_7d: logRows?.length ?? 0,
    by_persona: accessByPersona,
    by_country: Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
    daily: dailyCount,
  }

  return NextResponse.json({ videos: stats, access_logs: accessLogs })
}
