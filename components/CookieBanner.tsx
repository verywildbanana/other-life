'use client'

import { useState, useEffect } from 'react'

const COOKIE_CONSENT_KEY = 'anomess_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="쿠키 사용 동의"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
    >
      <div className="max-w-2xl mx-auto bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-zinc-300 text-sm flex-1">
          Anomess는 서비스 품질 향상을 위해 분석용 쿠키를 사용합니다.{' '}
          <a href="/legal/privacy" className="underline hover:text-white">
            자세히 보기
          </a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition-colors"
          >
            거부
          </button>
          <button
            onClick={accept}
            className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            동의
          </button>
        </div>
      </div>
    </div>
  )
}
