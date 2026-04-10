import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  const expected = process.env.ADMIN_SECRET_TOKEN ?? ''

  if (!expected || token !== expected) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const res = NextResponse.json({ status: 'ok' })
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24시간
  })
  return res
}
