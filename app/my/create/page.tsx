'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AnoHeader from '@/components/AnoHeader'

type Lang = 'ko' | 'en' | 'ja'

const t: Record<Lang, {
  pageTitle: string
  nameSection: string
  descSection: string
  namePlaceholderKo: string
  namePlaceholderEn: string
  namePlaceholderJa: string
  descPlaceholderKo: string
  descPlaceholderEn: string
  descPlaceholderJa: string
  nameRequired: string
  cancel: string
  creating: string
  create: string
  networkError: string
}> = {
  ko: {
    pageTitle: '내 피드 만들기',
    nameSection: '페르소나 이름',
    descSection: '한 줄 소개 (선택)',
    namePlaceholderKo: '예: 재즈 좋아하는 30대',
    namePlaceholderEn: 'e.g. Jazz Lover in 30s (optional)',
    namePlaceholderJa: '例: ジャズ好きな30代 (optional)',
    descPlaceholderKo: '이 피드는 어떤 사람의 알고리즘인가요?',
    descPlaceholderEn: "What's this person's YouTube taste?",
    descPlaceholderJa: 'このフィードはどんな人のアルゴリズムですか？',
    nameRequired: '한국어 이름은 2자 이상 입력해주세요.',
    cancel: '취소',
    creating: '생성 중...',
    create: '피드 만들기',
    networkError: '네트워크 오류',
  },
  en: {
    pageTitle: 'Create My Feed',
    nameSection: 'Persona Name',
    descSection: 'Short Description (optional)',
    namePlaceholderKo: 'e.g. 재즈 좋아하는 30대 (Korean)',
    namePlaceholderEn: 'e.g. Jazz Lover in 30s',
    namePlaceholderJa: 'e.g. ジャズ好きな30代 (Japanese, optional)',
    descPlaceholderKo: '이 피드는 어떤 사람의 알고리즘인가요? (Korean)',
    descPlaceholderEn: "What's this person's YouTube taste?",
    descPlaceholderJa: 'このフィードはどんな人のアルゴリズムですか？ (Japanese)',
    nameRequired: 'Korean name must be at least 2 characters.',
    cancel: 'Cancel',
    creating: 'Creating...',
    create: 'Create Feed',
    networkError: 'Network error',
  },
  ja: {
    pageTitle: 'マイフィードを作成',
    nameSection: 'ペルソナ名',
    descSection: '一言紹介 (任意)',
    namePlaceholderKo: '例: 재즈 좋아하는 30대 (韓国語)',
    namePlaceholderEn: 'e.g. Jazz Lover in 30s (英語, 任意)',
    namePlaceholderJa: '例: ジャズ好きな30代',
    descPlaceholderKo: '이 피드는 어떤 사람의 알고리즘인가요？ (韓国語)',
    descPlaceholderEn: "What's this person's YouTube taste? (英語)",
    descPlaceholderJa: 'このフィードはどんな人のアルゴリズムですか？',
    nameRequired: '韓国語名を2文字以上入力してください。',
    cancel: 'キャンセル',
    creating: '作成中...',
    create: 'フィードを作成',
    networkError: 'ネットワークエラー',
  },
}

function CreatePersonaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = (searchParams.get('lang') ?? 'ko') as Lang
  const s = t[lang] ?? t.ko

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
      setError(s.nameRequired)
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
        setError(data.error ?? s.networkError)
        return
      }
      router.push(`/p/${data.persona.persona_id}?lang=${lang}`)
    } catch {
      setError(s.networkError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <AnoHeader />
      <div className="px-4 py-12 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">{s.pageTitle}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 이름 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">{s.nameSection}</h2>
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500 w-6">KO</span>
              <input
                value={nameKo}
                onChange={e => setNameKo(e.target.value)}
                placeholder={s.namePlaceholderKo}
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
                placeholder={s.namePlaceholderEn}
                maxLength={40}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500 w-6">JA</span>
              <input
                value={nameJa}
                onChange={e => setNameJa(e.target.value)}
                placeholder={s.namePlaceholderJa}
                maxLength={40}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* 소개 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">{s.descSection}</h2>
          <div className="space-y-2">
            {[
              { lang: 'KO', value: descKo, set: setDescKo, placeholder: s.descPlaceholderKo },
              { lang: 'EN', value: descEn, set: setDescEn, placeholder: s.descPlaceholderEn },
              { lang: 'JA', value: descJa, set: setDescJa, placeholder: s.descPlaceholderJa },
            ].map(({ lang: l, value, set, placeholder }) => (
              <div key={l} className="flex gap-2 items-center">
                <span className="text-xs text-zinc-500 w-6">{l}</span>
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
            {s.cancel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? s.creating : s.create}
          </button>
        </div>
      </form>
      </div>
    </main>
  )
}

export default function CreatePersonaPage() {
  return (
    <Suspense>
      <CreatePersonaContent />
    </Suspense>
  )
}
