/**
 * 인메모리 Rate Limiter
 * Vercel Edge/Serverless 환경: 함수 인스턴스 간 공유 안 됨 → 간단한 남용 방지 용도
 * 엄격한 제한이 필요하면 Upstash Redis 기반으로 교체 권장
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// 메모리 저장소 (인스턴스 재시작 시 초기화)
const store = new Map<string, RateLimitEntry>()

// 주기적으로 만료된 항목 정리 (메모리 누수 방지)
const CLEANUP_INTERVAL = 60 * 1000 // 1분
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, CLEANUP_INTERVAL)

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * IP 기반 Rate Limit 확인
 * @param ip 클라이언트 IP
 * @param limit 허용 횟수
 * @param windowSec 윈도우 크기 (초)
 */
export function checkRateLimit(
  ip: string,
  limit: number = 60,
  windowSec: number = 60,
): RateLimitResult {
  const now = Date.now()
  const key = `rl:${ip}`
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // 새 윈도우 시작
    const resetAt = now + windowSec * 1000
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * NextRequest에서 실제 클라이언트 IP 추출
 */
export function getClientIp(req: Request): string {
  const headers = new Headers((req as any).headers)
  return (
    headers.get('cf-connecting-ip') ??       // Cloudflare
    headers.get('x-real-ip') ??              // Nginx
    headers.get('x-forwarded-for')?.split(',')[0].trim() ?? // 프록시
    'unknown'
  )
}
