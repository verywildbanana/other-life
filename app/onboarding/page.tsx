'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Lang = 'ko' | 'en' | 'ja'

const t: Record<Lang, {
  title: string
  subtitle: string
  nicknameLabel: string
  nicknamePlaceholder: string
  nicknameTooShort: string
  tosAgree: string
  terms: string
  privacy: string
  required: string
  ageVerify: string
  saving: string
  submit: string
  skip: string
  errorFallback: string
}> = {
  ko: {
    title: '환영합니다! 👋',
    subtitle: 'Anomess에서 사용할 닉네임을 설정하세요',
    nicknameLabel: '닉네임',
    nicknamePlaceholder: '2~20자',
    nicknameTooShort: '닉네임은 2자 이상이어야 합니다',
    tosAgree: '에 동의합니다',
    terms: '이용약관',
    privacy: '개인정보처리방침',
    required: '(필수)',
    ageVerify: '만 14세 이상임을 확인합니다',
    saving: '저장 중...',
    submit: '시작하기',
    skip: '나중에 설정하기',
    errorFallback: '오류가 발생했습니다',
  },
  en: {
    title: 'Welcome! 👋',
    subtitle: 'Set a nickname for Anomess',
    nicknameLabel: 'Nickname',
    nicknamePlaceholder: '2–20 characters',
    nicknameTooShort: 'Nickname must be at least 2 characters',
    tosAgree: 'I agree to the',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    required: '(required)',
    ageVerify: 'I confirm I am 14 years of age or older',
    saving: 'Saving...',
    submit: 'Get started',
    skip: 'Set up later',
    errorFallback: 'An error occurred',
  },
  ja: {
    title: 'ようこそ！ 👋',
    subtitle: 'Anomessで使うニックネームを設定してください',
    nicknameLabel: 'ニックネーム',
    nicknamePlaceholder: '2〜20文字',
    nicknameTooShort: 'ニックネームは2文字以上にしてください',
    tosAgree: 'に同意します',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    required: '(必須)',
    ageVerify: '14歳以上であることを確認します',
    saving: '保存中...',
    submit: 'はじめる',
    skip: 'あとで設定する',
    errorFallback: 'エラーが発生しました',
  },
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = (searchParams.get('lang') ?? 'ko') as Lang
  const s = t[lang] ?? t.ko

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
        body: JSON.stringify({ nickname: nickname.trim(), tos_agreed: true, age_verified: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? s.errorFallback)
      }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : s.errorFallback)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-white text-xl font-semibold">{s.title}</h1>
          <p className="text-zinc-400 text-sm">{s.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 닉네임 */}
          <div className="space-y-1.5">
            <label className="text-zinc-300 text-sm font-medium" htmlFor="nickname">
              {s.nicknameLabel}
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder={s.nicknamePlaceholder}
              maxLength={20}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-500"
            />
            {nickname.length > 0 && nickname.trim().length < 2 && (
              <p className="text-red-400 text-xs">{s.nicknameTooShort}</p>
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
                {lang === 'en' ? (
                  <>
                    {s.tosAgree}{' '}
                    <a href="/legal/terms" target="_blank" className="underline hover:text-white">{s.terms}</a>
                    {' '}and{' '}
                    <a href="/legal/privacy" target="_blank" className="underline hover:text-white">{s.privacy}</a>
                    {' '}<span className="text-zinc-500">{s.required}</span>
                  </>
                ) : (
                  <>
                    <a href="/legal/terms" target="_blank" className="underline hover:text-white">{s.terms}</a>
                    {' '}및{' '}
                    <a href="/legal/privacy" target="_blank" className="underline hover:text-white">{s.privacy}</a>
                    {s.tosAgree}{' '}<span className="text-zinc-500">{s.required}</span>
                  </>
                )}
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
                {s.ageVerify} <span className="text-zinc-500">{s.required}</span>
              </span>
            </label>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? s.saving : s.submit}
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full text-zinc-500 hover:text-zinc-400 text-sm py-2 transition-colors"
            >
              {s.skip}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
