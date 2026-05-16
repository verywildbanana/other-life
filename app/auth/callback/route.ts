import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/auth'

// Google OAuth 콜백 처리
// Supabase가 ?code=xxx&next=yyy 로 리다이렉트함
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // SSRF 방어: next 파라미터가 외부 도메인이면 홈으로
  const safeNext = next.startsWith('/') ? next : '/'

  if (code) {
    const supabase = await createAuthClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 로그인 성공 → 온보딩 or 원래 페이지로
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${safeNext}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${safeNext}`)
      } else {
        return NextResponse.redirect(`${origin}${safeNext}`)
      }
    }
  }

  // 코드 없거나 교환 실패 → 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
