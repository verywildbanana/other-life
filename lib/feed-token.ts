/**
 * feed-token.ts — 피드 API 접근 토큰 (HMAC-SHA256 서명)
 *
 * 구조: base64url(payload) + "." + base64url(HMAC서명)
 * 검증: 서명 일치 + 만료 미초과 + UA해시 일치
 *
 * 목적: 우리 서비스 페이지에서만 API 호출 가능하도록 제한
 * (외부에서 직접 curl/스크립트로 호출 불가)
 */

import { createHmac, createHash, timingSafeEqual } from 'crypto'

const COOKIE_NAME = 'feed_token'
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24시간

interface TokenPayload {
  id: string        // 세션 UUID
  iat: number       // 발급 시각 (ms)
  exp: number       // 만료 시각 (ms)
  ua: string        // UA 해시 (sha256 앞 16자)
}

function getSecret(): string {
  const secret = process.env.FEED_TOKEN_SECRET
  if (!secret) throw new Error('FEED_TOKEN_SECRET 환경변수가 설정되지 않았습니다')
  return secret
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

/** UA 문자열 → 16자 해시 */
export function hashUA(ua: string): string {
  return createHash('sha256').update(ua).digest('hex').slice(0, 16)
}

/** 토큰 발급 */
export function issueToken(ua: string): string {
  const payload: TokenPayload = {
    id: crypto.randomUUID(),
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    ua: hashUA(ua),
  }
  const payloadB64 = b64url(JSON.stringify(payload))
  const sig = b64url(
    createHmac('sha256', getSecret()).update(payloadB64).digest()
  )
  return `${payloadB64}.${sig}`
}

/** 토큰 검증 결과 */
type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'missing' | 'malformed' | 'invalid_sig' | 'expired' | 'ua_mismatch' }

/** 토큰 검증 */
export function verifyToken(token: string | undefined, ua: string): VerifyResult {
  if (!token) return { ok: false, reason: 'missing' }

  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'malformed' }

  const [payloadB64, sigB64] = parts

  // 서명 검증 (timing-safe)
  const expectedSig = b64url(
    createHmac('sha256', getSecret()).update(payloadB64).digest()
  )
  try {
    const a = Buffer.from(sigB64)
    const b = Buffer.from(expectedSig)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'invalid_sig' }
    }
  } catch {
    return { ok: false, reason: 'invalid_sig' }
  }

  // 페이로드 파싱
  let payload: TokenPayload
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  // 만료 확인
  if (Date.now() > payload.exp) return { ok: false, reason: 'expired' }

  // UA 해시 일치 확인
  if (hashUA(ua) !== payload.ua) return { ok: false, reason: 'ua_mismatch' }

  return { ok: true, payload }
}

export { COOKIE_NAME, TOKEN_TTL_MS }
