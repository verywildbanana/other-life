/**
 * suspicious.ts — 의심 요청 로깅 + 임계값 초과 시 Telegram 알림
 *
 * 401 발생 시 suspicious_requests 테이블에 기록하고,
 * 동일 IP가 10분 내 20회 이상이면 알림 전송 (20회 배수마다 반복)
 */

import { createClient } from '@supabase/supabase-js'
import { sendAlert } from '@/lib/alert'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** IP 주소 추출 */
function getClientIp(req: Request): string {
  return (
    (req.headers as Headers).get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

/** 문자열 SHA-256 해시 → hex (Web Crypto, Edge 호환) */
async function sha256hex(value: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(value))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 의심 요청 기록 + 임계값 초과 시 알림
 * - 10분 내 동일 IP 20회↑ → 알림 (20배수마다 반복)
 * - fire-and-forget 방식으로 호출 (await 불필요)
 */
export async function logSuspicious(
  req: Request,
  personaId: string,
  reason: string,
): Promise<void> {
  const ip = getClientIp(req)
  const ua = (req.headers as Headers).get('user-agent') ?? ''
  const ipHash = await sha256hex(ip)
  const uaHash = (await sha256hex(ua)).slice(0, 16)

  // DB 기록
  const { error } = await supabaseAdmin.from('suspicious_requests').insert({
    ip_hash: ipHash,
    ua_hash: uaHash,
    reason,
    persona_id: personaId,
  })

  if (error) return // DB 에러는 무시

  // 최근 10분 내 같은 IP의 요청 수 확인
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabaseAdmin
    .from('suspicious_requests')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since)

  if (!count) return

  // 20회 배수일 때만 알림 (첫 알림: 20회, 이후 40, 60...)
  if (count % 20 === 0) {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    await sendAlert(
      `🚨 <b>PersonaFeed API 이상 접근 감지</b>\n\n` +
      `⏰ ${now}\n` +
      `📍 IP hash: <code>${ipHash.slice(0, 12)}...</code>\n` +
      `🔢 10분 내 접근: <b>${count}회</b>\n` +
      `❌ 사유: <code>${reason}</code>\n` +
      `🎭 페르소나: ${personaId}`,
    )
  }
}
