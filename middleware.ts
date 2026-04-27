/**
 * middleware.ts — 피드 세션 토큰 자동 발급
 *
 * /p/* 페이지 진입 시 feed_token 쿠키가 없거나 만료되면 새로 발급
 * 발급된 토큰은 /api/feed/* 호출 시 자동으로 쿠키에 포함됨
 */

import { NextRequest, NextResponse } from 'next/server'
import { issueToken, verifyToken, COOKIE_NAME, TOKEN_TTL_MS } from '@/lib/feed-token'
import { logAdminAccess } from '@/lib/admin-log'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // /admin, /api/admin/* 접근 로깅
  if (pathname === '/admin' || pathname.startsWith('/api/admin/')) {
    logAdminAccess(req)
  }

  // /admin 페이지: 토큰 없으면 /admin/login으로 redirect (미들웨어 레벨 접근 제어)
  // /admin/login 자체는 체크 제외 (redirect 루프 방지)
  if (pathname === '/admin') {
    const adminToken = req.cookies.get('admin_token')?.value
    const expected   = process.env.ADMIN_SECRET_TOKEN
    if (!expected || adminToken !== expected) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/admin/login'
      return NextResponse.redirect(loginUrl)
    }
  }

  // /p/* 페이지 진입 시만 토큰 발급
  if (!pathname.startsWith('/p/')) return NextResponse.next()

  const ua = req.headers.get('user-agent') ?? ''
  const existing = req.cookies.get(COOKIE_NAME)?.value

  // 기존 토큰이 유효하면 그대로 통과
  const result = await verifyToken(existing, ua)
  if (result.ok) return NextResponse.next()

  // 신규 발급 (만료, 없음, UA 불일치 모두 재발급)
  const token = await issueToken(ua)
  const res = NextResponse.next()
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,          // JS에서 접근 불가 (XSS 방지)
    secure: true,            // HTTPS only
    sameSite: 'strict',      // CSRF 방지
    maxAge: TOKEN_TTL_MS / 1000,
    path: '/',
  })
  return res
}

export const config = {
  matcher: ['/p/:path*', '/admin', '/admin/login', '/api/admin/:path*'],
}
