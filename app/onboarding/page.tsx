'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [agreedTos, setAgreedTos] = useState(false)
  const [agreedAge, setAgreedAge] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = nickname.trim().length >= 2 && agreedTos && agreedAge

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          tos_agreed: true,
          age_verified: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '프로필 저장에 실패했습니다')
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    // 온보딩 건너뛰기 — 홈으로 (닉네임은 나중에 설정 가능)
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-white text-xl font-semibold">환영합니다! 👋</h1>
          <p className="text-zinc-400 text-sm">
            Anomess에서 사용할 닉네임을 설정하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 닉네임 */}
          <div className="space-y-1.5">
            <label className="text-zinc-300 text-sm font-medium" htmlFor="nickname">
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="2~20자"
              maxLength={20}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500"
            />
            {nickname.length > 0 && nickname.trim().length < 2 && (
              <p className="text-red-400 text-xs">닉네임은 2자 이상이어야 합니다</p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTos}
                onChange={e => setAgreedTos(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-0"
              />
              <span className="text-zinc-300 text-sm">
                <a href="/legal/terms" target="_blank" className="underline hover:text-white">
                  이용약관
                </a>
                {' '}및{' '}
                <a href="/legal/privacy" target="_blank" className="underline hover:text-white">
                  개인정보처리방침
                </a>
                에 동의합니다 <span className="text-zinc-500">(필수)</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedAge}
                onChange={e => setAgreedAge(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-0"
              />
              <span className="text-zinc-300 text-sm">
                만 14세 이상임을 확인합니다 <span className="text-zinc-500">(필수)</span>
              </span>
            </label>
          </div>

          {/* 에러 */}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {/* 버튼들 */}
          <div className="space-y-2">
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? '저장 중...' : '시작하기'}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-zinc-500 hover:text-zinc-400 text-sm py-2 transition-colors"
            >
              나중에 설정하기
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
