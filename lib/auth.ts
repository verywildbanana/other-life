import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

// SSR용 Supabase 클라이언트 — 쿠키 기반 세션 관리
export async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component에서는 set이 불가 — 미들웨어가 처리
          }
        },
      },
    },
  )
}

// 현재 로그인 유저 반환 (없으면 null)
export async function getUser(): Promise<User | null> {
  const supabase = await createAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// 로그인 필수 — 없으면 /login으로 리다이렉트
export async function requireUser(redirectTo?: string): Promise<User> {
  const user = await getUser()
  if (!user) {
    const params = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''
    redirect(`/login${params}`)
  }
  return user
}
