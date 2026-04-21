import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

function verifyAdmin(req: NextRequest): boolean {
  const token = req.cookies.get('admin_token')?.value
  return token === process.env.ADMIN_SECRET_TOKEN
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

function getAdminIpHash(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  return hashIp(ip)
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
  const myIpHash = getAdminIpHash(req)

  const { data: logRows } = await supabase
    .from('access_logs')
    .select('persona_id, country, accessed_at, ip_hash')
    .gte('accessed_at', since7d)
    .order('accessed_at', { ascending: false })

  // 페르소나별 접근 수 집계
  const accessByPersona: Record<string, number> = {}
  const countryCount: Record<string, number> = {}
  const dailyCount: Record<string, number> = {}
  const uniqueIps = new Set<string>()
  const externalIps = new Set<string>()

  for (const row of logRows ?? []) {
    accessByPersona[row.persona_id] = (accessByPersona[row.persona_id] ?? 0) + 1
    if (row.country) countryCount[row.country] = (countryCount[row.country] ?? 0) + 1
    const day = (row.accessed_at as string).slice(0, 10)
    dailyCount[day] = (dailyCount[day] ?? 0) + 1
    if (row.ip_hash) {
      uniqueIps.add(row.ip_hash)
      if (row.ip_hash !== myIpHash) externalIps.add(row.ip_hash)
    }
  }

  const accessLogs = {
    total_7d: logRows?.length ?? 0,
    unique_ips: uniqueIps.size,
    external_unique_ips: externalIps.size,  // 나(어드민) 제외 고유 방문자 수
    my_ip_hash: myIpHash,
    by_persona: accessByPersona,
    by_country: Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
    daily: dailyCount,
  }

  // Admin 접근 로그 (최근 7일)
  const { data: adminLogRows } = await supabase
    .from('admin_logs')
    .select('path, method, country, ip_hash, created_at')
    .gte('created_at', since7d)
    .order('created_at', { ascending: false })
    .limit(200)

  // path별 집계
  const adminByPath: Record<string, number> = {}
  const adminByCountry: Record<string, number> = {}
  const adminByIp: Record<string, number> = {}

  for (const row of adminLogRows ?? []) {
    adminByPath[row.path] = (adminByPath[row.path] ?? 0) + 1
    if (row.country) adminByCountry[row.country] = (adminByCountry[row.country] ?? 0) + 1
    if (row.ip_hash) adminByIp[row.ip_hash] = (adminByIp[row.ip_hash] ?? 0) + 1
  }

  const adminLogs = {
    total_7d: adminLogRows?.length ?? 0,
    recent: (adminLogRows ?? []).slice(0, 50).map(r => ({
      path: r.path,
      method: r.method,
      country: r.country,
      ip_hash: r.ip_hash,
      created_at: r.created_at,
    })),
    by_path: Object.entries(adminByPath)
      .sort((a, b) => b[1] - a[1])
      .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
    by_country: Object.entries(adminByCountry)
      .sort((a, b) => b[1] - a[1])
      .reduce<Record<string, number>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
    unique_ips: Object.keys(adminByIp).length,
  }

  return NextResponse.json({ videos: stats, access_logs: accessLogs, admin_logs: adminLogs })
}
