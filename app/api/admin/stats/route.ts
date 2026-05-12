import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { listPersonas } from '@/lib/personas'

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

  // 페르소나별 정확한 카운트 — COUNT(*) 사용 (이전: select 전체 후 메모리 집계 → 1000 row limit 버그)
  const personas = listPersonas()
  const feedStatsArr = await Promise.all(
    personas.map(async (p) => {
      const [countRes, summaryRes, latestRes] = await Promise.all([
        // 전체 카운트 (head: true → 데이터 row 미전송, count만 반환)
        supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('persona_id', p.id),
        // summary_i18n 필드만 가져와 AI요약/skip/미완료 분류
        supabase
          .from('videos')
          .select('summary_i18n')
          .eq('persona_id', p.id),
        // 최신 수집일
        supabase
          .from('videos')
          .select('collected_date')
          .eq('persona_id', p.id)
          .order('collected_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const rows = summaryRes.data ?? []
      const withSummary = rows.filter((r) => {
        const s = r.summary_i18n as Record<string, unknown> | null
        return s && !s.stt_skip && (s.ko || s.en || s.ja)
      }).length
      const sttSkip = rows.filter((r) => {
        const s = r.summary_i18n as Record<string, unknown> | null
        return s?.stt_skip === true
      }).length

      return {
        persona_id: p.id,
        total: countRes.count ?? 0,
        with_summary: withSummary,
        stt_skip: sttSkip,
        no_summary: (countRes.count ?? 0) - withSummary - sttSkip,
        latest_date: latestRes.data?.collected_date ?? null,
      }
    })
  )

  const stats: Record<string, { total: number; with_summary: number; stt_skip: number; no_summary: number; latest_date: string | null }> = {}
  for (const s of feedStatsArr) {
    stats[s.persona_id] = s
  }

  // period 파라미터 — 7d(기본) / 30d / 90d
  const period = req.nextUrl.searchParams.get('period') ?? '7d'
  const periodDays = period === '90d' ? 90 : period === '30d' ? 30 : 7
  const since7d = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()
  const myIpHash = getAdminIpHash(req)

  const { data: logRows } = await supabase
    .from('access_logs')
    .select('persona_id, country, accessed_at, ip_hash')
    .gte('accessed_at', since7d)
    .order('accessed_at', { ascending: false })

  // admin IP 제외 후 전체 집계
  const externalRows = (logRows ?? []).filter((r) => r.ip_hash !== myIpHash)

  const accessByPersona: Record<string, number> = {}
  const countryCount: Record<string, number> = {}
  const dailyCount: Record<string, number> = {}
  const uniqueIps = new Set<string>()

  for (const row of externalRows) {
    accessByPersona[row.persona_id] = (accessByPersona[row.persona_id] ?? 0) + 1
    if (row.country) countryCount[row.country] = (countryCount[row.country] ?? 0) + 1
    const day = (row.accessed_at as string).slice(0, 10)
    dailyCount[day] = (dailyCount[day] ?? 0) + 1
    if (row.ip_hash) uniqueIps.add(row.ip_hash)
  }

  const accessLogs = {
    total_7d: externalRows.length,          // admin 제외 총 요청 수
    unique_ips: uniqueIps.size,             // admin 제외 고유 방문자 수 (= external_unique_ips)
    external_unique_ips: uniqueIps.size,    // 하위 호환성 유지
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

  // 유저 행동 이벤트 집계 (최근 7일) — events 테이블 없으면 조용히 빈값 반환
  let userBehavior: {
    sessions_7d: number
    video_clicks_7d: number
    scroll_loads_7d: number
    avg_clicks_per_session: number
    scroll_depth: { page1_only: number; page2_4: number; page5_plus: number }
    top_videos: { video_id: string; clicks: number }[]
  } = {
    sessions_7d: 0,
    video_clicks_7d: 0,
    scroll_loads_7d: 0,
    avg_clicks_per_session: 0,
    scroll_depth: { page1_only: 0, page2_4: 0, page5_plus: 0 },
    top_videos: [],
  }

  try {
    const [clickRows, scrollRows] = await Promise.all([
      supabase
        .from('events')
        .select('session_id, video_id')
        .eq('event_type', 'video_click')
        .gte('created_at', since7d),
      supabase
        .from('events')
        .select('session_id, scroll_page')
        .eq('event_type', 'scroll_load')
        .gte('created_at', since7d),
    ])

    if (!clickRows.error && !scrollRows.error) {
      const clicks = clickRows.data ?? []
      const scrolls = scrollRows.data ?? []

      // 고유 세션 수 (클릭 + 스크롤 합산)
      const allSessions = new Set([
        ...clicks.map((r) => r.session_id),
        ...scrolls.map((r) => r.session_id),
      ])
      const sessionsCount = allSessions.size

      // 상위 클릭 영상
      const videoClickCount: Record<string, number> = {}
      for (const r of clicks) {
        if (r.video_id) videoClickCount[r.video_id] = (videoClickCount[r.video_id] ?? 0) + 1
      }
      const topVideos = Object.entries(videoClickCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([video_id, count]) => ({ video_id, clicks: count }))

      // 스크롤 깊이 — 세션별 최대 scroll_page
      const sessionMaxPage: Record<string, number> = {}
      for (const r of scrolls) {
        const p = r.scroll_page ?? 1
        sessionMaxPage[r.session_id] = Math.max(sessionMaxPage[r.session_id] ?? 0, p)
      }
      const maxPages = Object.values(sessionMaxPage)
      const page1Only = maxPages.filter((p) => p === 1).length
      const page2_4 = maxPages.filter((p) => p >= 2 && p <= 4).length
      const page5Plus = maxPages.filter((p) => p >= 5).length

      userBehavior = {
        sessions_7d: sessionsCount,
        video_clicks_7d: clicks.length,
        scroll_loads_7d: scrolls.length,
        avg_clicks_per_session: sessionsCount > 0 ? Math.round((clicks.length / sessionsCount) * 10) / 10 : 0,
        scroll_depth: { page1_only: page1Only, page2_4, page5_plus: page5Plus },
        top_videos: topVideos,
      }
    }
  } catch {
    // events 테이블 없으면 빈값 유지
  }

  // 피드백 통계
  const { data: feedbackRows } = await supabase
    .from('feedback')
    .select('rating')
    .not('rating', 'is', null)

  const feedbackStats = (() => {
    const rows = feedbackRows ?? []
    if (rows.length === 0) return null
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let total = 0
    for (const r of rows) {
      const rating = r.rating as number
      if (rating >= 1 && rating <= 5) {
        dist[rating] = (dist[rating] ?? 0) + 1
        total += rating
      }
    }
    const count = rows.length
    return { count, avg: Math.round((total / count) * 10) / 10, dist }
  })()

  return NextResponse.json({ videos: stats, access_logs: accessLogs, admin_logs: adminLogs, user_behavior: userBehavior, feedback_stats: feedbackStats })
}
