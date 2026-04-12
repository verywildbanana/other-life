import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  const expected = process.env.ADMIN_SECRET_TOKEN ?? ''

  if (!expected || token !== expected) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const res = NextResponse.json({ status: 'ok' })
  res.cookies.set('admin_token', token, {
    httpOnly: true,   // JS 접근 차단 (XSS 방어)
    secure: true,     // HTTPS 전용
    sameSite: 'strict', // CSRF 방어 강화 (lax → strict)
    path: '/',        // /api/admin/* 포함 전체 경로에 전송
    maxAge: 60 * 60 * 8, // 8시간 (기존 24시간 → 보안 강화)
  })
  return res
}
