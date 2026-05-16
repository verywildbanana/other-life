'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreatePersonaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [nameKo, setNameKo] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameJa, setNameJa] = useState('')
  const [descKo, setDescKo] = useState('')
  const [descEn, setDescEn] = useState('')
  const [descJa, setDescJa] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nameKo.trim().length < 2) {
      setError('한국어 이름은 2자 이상 입력해주세요.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/user/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_i18n: {
            ko: nameKo.trim(),
            en: nameEn.trim() || nameKo.trim(),
            ja: nameJa.trim() || nameKo.trim(),
          },
          description_i18n: {
            ko: descKo.trim(),
            en: descEn.trim(),
            ja: descJa.trim(),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '생성 실패')
        return
      }
      router.push(`/p/${data.persona.persona_id}`)
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-12 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">내 피드 만들기</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이름 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">페르소나 이름</h2>
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500 w-6">KO</span>
              <input
                value={nameKo}
                onChange={e => setNameKo(e.target.value)}
                placeholder="예: 재즈 좋아하는 30대"
                maxLength={30}
                required
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500 w-6">EN</span>
              <input
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Jazz Lover in 30s (optional)"
                maxLength={40}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500 w-6">JA</span>
              <input
                value={nameJa}
                onChange={e => setNameJa(e.target.value)}
                placeholder="例: ジャズ好きな30代 (optional)"
                maxLength={40}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* 소개 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">한 줄 소개 (선택)</h2>
          <div className="space-y-2">
            {[
              { lang: 'KO', value: descKo, set: setDescKo, placeholder: '이 피드는 어떤 사람의 알고리즘인가요?' },
              { lang: 'EN', value: descEn, set: setDescEn, placeholder: "What's this person's YouTube taste?" },
              { lang: 'JA', value: descJa, set: setDescJa, placeholder: 'このフィードはどんな人のアルゴリズムですか？' },
            ].map(({ lang, value, set, placeholder }) => (
              <div key={lang} className="flex gap-2 items-center">
                <span className="text-xs text-zinc-500 w-6">{lang}</span>
                <input
                  value={value}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  maxLength={100}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? '생성 중...' : '피드 만들기'}
          </button>
        </div>
      </form>
    </main>
  )
}
