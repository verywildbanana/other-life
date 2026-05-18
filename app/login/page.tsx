'use client'

import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useState } from 'react'
import AnoHeader from '@/components/AnoHeader'

type Lang = 'ko' | 'en' | 'ja'

const t: Record<Lang, {
  title: string
  subtitle: string
  googleBtn: string
  error: string
  terms: string
  privacy: string
  termsNote: string
}> = {
  ko: {
    title: 'Log in to Anomess',
    subtitle: '나만의 YouTube 피드를 만들고 공유하세요',
    googleBtn: 'Continue with Google',
    error: '로그인 중 문제가 발생했습니다. 다시 시도해주세요.',
    terms: '이용약관',
    privacy: '개인정보처리방침',
    termsNote: '계속하면 {terms} 및 {privacy}에 동의하는 것입니다',
  },
  en: {
    title: 'Log in to Anomess',
    subtitle: 'Create and share your own YouTube feed',
    googleBtn: 'Continue with Google',
    error: 'Something went wrong. Please try again.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    termsNote: 'By continuing, you agree to the {terms} and {privacy}',
  },
  ja: {
    title: 'Log in to Anomess',
    subtitle: '自分だけのYouTubeフィードを作って共有しよう',
    googleBtn: 'Continue with Google',
    error: 'ログイン中に問題が発生しました。もう一度お試しください。',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    termsNote: '続けることで{terms}および{privacy}に同意したことになります',
  },
}

/** 카카오톡·라인·인스타그램 등 인앱 브라우저 여부 감지 */
function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /KAKAOTALK|kakaotalk|Line\/|Instagram|FBAN|FBAV|FB_IAB|NaverApp|naver/i.test(ua)
    || /Android.*wv\)/i.test(ua)
}

function LoginContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'
  const error = searchParams.get('error')
  const lang = (searchParams.get('lang') ?? 'ko') as Lang
  const s = t[lang] ?? t.ko

  const [isInApp, setIsInApp] = useState(false)
  useEffect(() => { setIsInApp(detectInAppBrowser()) }, [])

  /** Android: Chrome intent URL로 열기, iOS: window.open fallback */
  function openInBrowser() {
    const url = window.location.href
    const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end`
    window.location.href = intentUrl
    setTimeout(() => { window.open(url, '_blank') }, 300)
  }

  async function handleGoogleLogin() {
    const supabase = createClient()
    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
  }

  // {terms} / {privacy} 치환
  const termsNote = s.termsNote
    .split('{terms}').join('__TERMS__')
    .split('{privacy}').join('__PRIVACY__')
  const termsParts = termsNote.split('__TERMS__')
  const beforeTerms = termsParts[0]
  const afterTermsParts = (termsParts[1] ?? '').split('__PRIVACY__')
  const betweenLinks = afterTermsParts[0]
  const afterPrivacy = afterTermsParts[1] ?? ''

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col">
      <AnoHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* 로고 */}
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/anomess-logo.png"
            alt="Anomess"
            className="h-16 w-auto rounded-2xl"
          />
          <h1 className="text-white text-xl font-semibold">{s.title}</h1>
          <p className="text-zinc-400 text-sm text-center">{s.subtitle}</p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm text-center">
            {s.error}
          </div>
        )}

        {/* 인앱 브라우저 감지 시 외부 브라우저 안내 / 일반 환경 Google 버튼 */}
        {isInApp ? (
          <div className="space-y-4">
            <div className="bg-amber-950/50 border border-amber-700 rounded-xl px-4 py-4 text-center space-y-2">
              <p className="text-amber-300 text-sm font-medium">
                인앱 브라우저에서는 Google 로그인이 지원되지 않습니다
              </p>
              <p className="text-amber-400/70 text-xs">
                Google 정책상 카카오톡·라인 등 앱 내 브라우저에서는 로그인이 차단됩니다.
                아래 버튼을 눌러 기기의 기본 브라우저(Chrome/Safari)에서 열어주세요.
              </p>
            </div>
            <button
              onClick={openInBrowser}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              기본 브라우저에서 열기
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-medium py-3 px-4 rounded-xl transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {s.googleBtn}
          </button>
        )}

        <p className="text-zinc-600 text-xs text-center">
          {beforeTerms}
          <a href="/legal/terms" className="underline hover:text-zinc-400">{s.terms}</a>
          {betweenLinks}
          <a href="/legal/privacy" className="underline hover:text-zinc-400">{s.privacy}</a>
          {afterPrivacy}
        </p>
      </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
