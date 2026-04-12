/**
 * rate-limit.ts — Supabase DB 기반 IP rate limiting
 *
 * Upstash Redis 없이 기존 Supabase로 구현.
 * Vercel Serverless에서 인메모리 방식은 인스턴스 간 공유 안 되므로 외부 저장소 필수.
 *
 * 사용: access_logs 테이블을 counting 소스로 활용
 */

import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

/** 클라이언트 IP 추출 */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}

/**
 * IP → 단방향 해시 (개인정보 최소화)
 * access_logs 테이블과 동일한 방식 사용 — salt 없음 (기존 데이터 호환)
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

interface RateLimitResult {
  limited: boolean   // true면 429 반환
  count: number      // 현재 윈도우 내 요청 수
}

/**
 * access_logs 기반 feed API rate limit 확인
 * @param ipHash - hashIp()로 처리된 IP 해시
 * @param windowMs - 확인할 시간 윈도우 (밀리초)
 * @param maxRequests - 윈도우 내 최대 허용 요청 수
 */
export async function checkFeedRateLimit(
  ipHash: string,
  windowMs: number = 60 * 1000,   // 기본 1분
  maxRequests: number = 60,        // 분당 60회
): Promise<RateLimitResult> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - windowMs).toISOString()

  const { count } = await supabase
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('accessed_at', since)

  const current = count ?? 0
  return { limited: current >= maxRequests, count: current }
}
