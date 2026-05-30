/**
 * middleware.ts — 피드 세션 토큰 자동 발급 + Supabase Auth 세션 갱신
 *
 * 1. Supabase Auth 세션 쿠키 갱신 (만료 전 자동 refresh)
 * 2. /p/* 페이지 진입 시 feed_token 쿠키 발급
 * 3. /admin 접근 제어
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { issueToken, verifyToken, COOKIE_NAME, TOKEN_TTL_MS } from '@/lib/feed-token'
import { logAdminAccess } from '@/lib/admin-log'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── other-life.vercel.app 일반 방문자 → play.anomess.com 리다이렉트 ─────
  // /api, /admin 경로 및 admin_token 쿠키 보유자(어드민 본인)는 제외
  const host = req.headers.get('host') ?? ''
  const hasAdminToken = !!req.cookies.get('admin_token')?.value
  if (
    host === 'other-life.vercel.app' &&
    !hasAdminToken &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/admin')
  ) {
    const target = new URL(req.url)
    target.host = 'play.anomess.com'
    target.protocol = 'https:'
    return NextResponse.redirect(target.toString(), { status: 301 })
  }

  // ── Supabase Auth 세션 갱신 ────────────────────────────────────────────
  // Server Component에서 쿠키를 안전하게 읽으려면 미들웨어에서 먼저 갱신해야 함
  let res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: { headers: req.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser()로 세션 검증 + 필요 시 자동 refresh
  await supabase.auth.getUser()

  // ── 어드민 접근 로깅 + 인증 ────────────────────────────────────────────
  if (pathname === '/admin' || pathname.startsWith('/api/admin/')) {
    logAdminAccess(req)
  }

  if (pathname === '/admin') {
    const adminToken = req.cookies.get('admin_token')?.value
    const expected   = process.env.ADMIN_SECRET_TOKEN
    if (!expected || adminToken !== expected) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── feed_token 발급 (/p/* 전용) ────────────────────────────────────────
  if (!pathname.startsWith('/p/')) return res

  const ua = req.headers.get('user-agent') ?? ''
  const existing = req.cookies.get(COOKIE_NAME)?.value

  const tokenResult = await verifyToken(existing, ua)
  if (tokenResult.ok) return res

  const token = await issueToken(ua)
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: TOKEN_TTL_MS / 1000,
    path: '/',
  })
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
}
