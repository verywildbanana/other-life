import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

// service_role 클라이언트 — access_logs 쓰기 권한 필요
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// IP를 SHA-256 해시로 변환 (개인정보 최소화)
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

// YouTube 방식: 30분 내 동일 IP + 동일 페르소나 재방문은 카운트 안 함
const DEDUP_WINDOW_MS = 30 * 60 * 1000

// feed API 호출 시 비동기 로깅 (응답 지연 없음 — fire-and-forget)
// 피드 응답과 완전히 병렬 처리됨 (logFeedAccess는 await 없이 호출됨)
export function logFeedAccess(req: NextRequest, personaId: string): void {
  // 봇/크롤러 제외
  const ua = req.headers.get('user-agent') ?? ''
  if (/bot|crawler|spider|Googlebot|Bingbot|Slurp|facebookexternalhit/i.test(ua)) return

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  const ipHash = hashIp(ip)

  const row = {
    persona_id: personaId,
    ip_hash: ipHash,
    user_agent: ua.substring(0, 200),
    referer: (req.headers.get('referer') ?? '').substring(0, 200),
    lang: (req.headers.get('accept-language') ?? '').substring(0, 20),
    country: req.headers.get('x-vercel-ip-country') ?? null,
  }

  const supabase = getServiceClient()
  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()

  // 30분 내 동일 (ip_hash, persona_id) 기록 확인 후 없을 때만 insert
  // 전체가 백그라운드 비동기 — 피드 응답에 영향 없음
  supabase
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('persona_id', personaId)
    .eq('ip_hash', ipHash)
    .gte('accessed_at', since)
    .then(({ count }) => {
      if ((count ?? 0) > 0) return  // 30분 내 재방문 → 스킵
      return supabase
        .from('access_logs')
        .insert(row)
        .then(({ error }) => {
          if (error) console.error('[access-log] insert error:', error.message)
        })
    })
}
