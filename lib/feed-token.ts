/**
 * feed-token.ts — 피드 API 접근 토큰 (HMAC-SHA256 서명)
 *
 * Edge Runtime 호환: Web Crypto API 사용 (Node.js crypto 모듈 미사용)
 * 구조: base64url(payload) + "." + base64url(HMAC서명)
 * 검증: 서명 일치 + 만료 미초과 + UA해시 일치
 *
 * 목적: 우리 서비스 페이지에서만 API 호출 가능하도록 제한
 */

export const COOKIE_NAME = 'feed_token'
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24시간

interface TokenPayload {
  id: string   // 세션 UUID
  iat: number  // 발급 시각 (ms)
  exp: number  // 만료 시각 (ms)
  ua: string   // UA 해시 (sha256 앞 16자)
}

function getSecret(): string {
  const secret = process.env.FEED_TOKEN_SECRET
  if (!secret) throw new Error('FEED_TOKEN_SECRET 환경변수가 설정되지 않았습니다')
  return secret
}

/** Uint8Array → base64url 인코딩 */
function b64url(buf: Uint8Array): string {
  let binary = ''
  buf.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** base64url 디코딩 → Uint8Array */
function fromB64url(s: string): Uint8Array {
  const padded = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(s.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

/** timing-safe 문자열 비교 (Edge Runtime에서 timingSafeEqual 대체) */
function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/** Web Crypto API로 HMAC-SHA256 서명 → base64url */
async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return b64url(new Uint8Array(sig))
}

/** UA 문자열 → 16자 해시 (Web Crypto API) */
export async function hashUA(ua: string): Promise<string> {
  const enc = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(ua))
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

/** 토큰 발급 */
export async function issueToken(ua: string): Promise<string> {
  const payload: TokenPayload = {
    id: crypto.randomUUID(),
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    ua: await hashUA(ua),
  }
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmacSign(getSecret(), payloadB64)
  return `${payloadB64}.${sig}`
}

/** 토큰 검증 결과 */
type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'missing' | 'malformed' | 'invalid_sig' | 'expired' | 'ua_mismatch' }

/** 토큰 검증 */
export async function verifyToken(
  token: string | undefined,
  ua: string,
): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing' }

  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'malformed' }

  const [payloadB64, sigB64] = parts

  // 서명 검증 (timing-safe)
  const expectedSig = await hmacSign(getSecret(), payloadB64)
  if (!timingSafeEquals(sigB64, expectedSig)) {
    return { ok: false, reason: 'invalid_sig' }
  }

  // 페이로드 파싱
  let payload: TokenPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(payloadB64)))
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  // 만료 확인
  if (Date.now() > payload.exp) return { ok: false, reason: 'expired' }

  // UA 해시 일치 확인
  if ((await hashUA(ua)) !== payload.ua) return { ok: false, reason: 'ua_mismatch' }

  return { ok: true, payload }
}
