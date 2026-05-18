'use client'

import { useState, useEffect } from 'react'

export type Lang = 'ko' | 'en' | 'ja'

const t: Record<Lang, { message: string; learnMore: string; decline: string; accept: string }> = {
  ko: {
    message: 'Anomess는 서비스 품질 향상을 위해 분석용 쿠키를 사용합니다.',
    learnMore: '자세히 보기',
    decline: '거부',
    accept: '동의',
  },
  en: {
    message: 'Anomess uses analytics cookies to improve our service.',
    learnMore: 'Learn more',
    decline: 'Decline',
    accept: 'Accept',
  },
  ja: {
    message: 'Anomessはサービス改善のために分析用クッキーを使用しています。',
    learnMore: '詳しく見る',
    decline: '拒否',
    accept: '同意',
  },
}

const COOKIE_CONSENT_KEY = 'anomess_cookie_consent'

export default function CookieBanner({ lang: langProp }: { lang?: Lang }) {
  const [visible, setVisible] = useState(false)
  const [lang, setLang] = useState<Lang>(langProp ?? 'ko')

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) setVisible(true)
    // 우선순위: langProp > URL 파라미터 > localStorage feed_lang > 기본값 ko
    if (langProp) {
      setLang(langProp)
    } else {
      const params = new URLSearchParams(window.location.search)
      const urlLang = params.get('lang') as Lang | null
      const savedLang = localStorage.getItem('feed_lang') as Lang | null
      const resolved = (urlLang && urlLang in t ? urlLang : null)
        ?? (savedLang && savedLang in t ? savedLang : null)
        ?? 'ko'
      setLang(resolved)
    }
  }, [langProp])

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  const s = t[lang]

  return (
    <div
      role="dialog"
      aria-label={s.message}
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-zinc-300 text-sm flex-1">
          {s.message}{' '}
          <a href="/legal/privacy" className="underline hover:text-white">
            {s.learnMore}
          </a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition-colors"
          >
            {s.decline}
          </button>
          <button
            onClick={accept}
            className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            {s.accept}
          </button>
        </div>
      </div>
    </div>
  )
}
