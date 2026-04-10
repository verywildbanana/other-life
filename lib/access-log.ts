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

// feed API 호출 시 비동기 로깅 (응답 지연 없음)
export function logFeedAccess(req: NextRequest, personaId: string): void {
  // 봇/크롤러 제외
  const ua = req.headers.get('user-agent') ?? ''
  if (/bot|crawler|spider|Googlebot|Bingbot|Slurp|facebookexternalhit/i.test(ua)) return

  // 비동기 fire-and-forget (await 없음 — 응답 지연 방지)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'

  const row = {
    persona_id: personaId,
    ip_hash: hashIp(ip),
    user_agent: ua.substring(0, 200),
    referer: (req.headers.get('referer') ?? '').substring(0, 200),
    lang: (req.headers.get('accept-language') ?? '').substring(0, 20),
    country: req.headers.get('x-vercel-ip-country') ?? null,
  }

  getServiceClient()
    .from('access_logs')
    .insert(row)
    .then(({ error }) => {
      if (error) console.error('[access-log] insert error:', error.message)
    })
}
