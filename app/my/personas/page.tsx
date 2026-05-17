'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type Lang = 'ko' | 'en' | 'ja'

const t: Record<Lang, {
  pageTitle: string
  newFeed: string
  loading: string
  empty: string
  createFirst: string
  viewFeed: string
  delete: string
  deleting: string
  maxReached: string
  videos: string
  public: string
  private: string
  confirmDelete: string
}> = {
  ko: {
    pageTitle: '내 피드',
    newFeed: '+ 새 피드 만들기',
    loading: '로딩 중...',
    empty: '아직 만든 피드가 없습니다.',
    createFirst: '첫 피드 만들기',
    viewFeed: '피드 보기',
    delete: '삭제',
    deleting: '삭제 중...',
    maxReached: '피드는 최대 3개까지 만들 수 있습니다.',
    videos: '영상',
    public: '공개',
    private: '비공개',
    confirmDelete: '피드를 삭제하시겠습니까?\n추가된 영상도 모두 삭제됩니다.',
  },
  en: {
    pageTitle: 'My Feeds',
    newFeed: '+ New Feed',
    loading: 'Loading...',
    empty: 'No feeds yet.',
    createFirst: 'Create your first feed',
    viewFeed: 'View Feed',
    delete: 'Delete',
    deleting: 'Deleting...',
    maxReached: 'You can create up to 3 feeds.',
    videos: 'videos',
    public: 'Public',
    private: 'Private',
    confirmDelete: 'Delete this feed?\nAll videos will also be removed.',
  },
  ja: {
    pageTitle: 'マイフィード',
    newFeed: '+ 新しいフィードを作成',
    loading: '読み込み中...',
    empty: 'まだフィードがありません。',
    createFirst: '最初のフィードを作成',
    viewFeed: 'フィードを見る',
    delete: '削除',
    deleting: '削除中...',
    maxReached: 'フィードは最大3つまで作成できます。',
    videos: '本',
    public: '公開',
    private: '非公開',
    confirmDelete: 'このフィードを削除しますか？\n追加した動画もすべて削除されます。',
  },
}

interface UserPersona {
  id: string
  persona_id: string
  name_i18n: Record<string, string>
  description_i18n: Record<string, string>
  is_public: boolean
  video_count: number
  created_at: string
}

function MyPersonasContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = (searchParams.get('lang') ?? 'ko') as Lang
  const s = t[lang] ?? t.ko

  const [personas, setPersonas] = useState<UserPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/personas')
      .then(r => r.json())
      .then(data => {
        if (data.personas) setPersonas(data.personas)
        else router.push(`/login?lang=${lang}`)
      })
      .finally(() => setLoading(false))
  }, [router, lang])

  async function handleDelete(personaId: string, name: string) {
    if (!confirm(`"${name}"\n${s.confirmDelete}`)) return
    setDeletingId(personaId)
    try {
      const res = await fetch(`/api/user/personas/${personaId}`, { method: 'DELETE' })
      if (res.ok) setPersonas(prev => prev.filter(p => p.persona_id !== personaId))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <span className="text-zinc-500 text-sm">{s.loading}</span>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-12 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{s.pageTitle}</h1>
        {personas.length < 3 && (
          <Link
            href={`/my/create?lang=${lang}`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors"
          >
            {s.newFeed}
          </Link>
        )}
      </div>

      {personas.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <p className="text-zinc-500 text-sm">{s.empty}</p>
          <Link
            href={`/my/create?lang=${lang}`}
            className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors"
          >
            {s.createFirst}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map(p => {
            const name = p.name_i18n[lang] ?? p.name_i18n.ko ?? p.name_i18n.en ?? p.persona_id
            const desc = p.description_i18n[lang] ?? p.description_i18n.ko ?? ''
            return (
              <div
                key={p.persona_id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{name}</p>
                    {desc && <p className="text-xs text-zinc-500 mt-0.5 truncate">{desc}</p>}
                    <p className="text-xs text-zinc-600 mt-1">
                      {p.video_count}{lang === 'ja' ? `本の${s.videos}` : ` ${s.videos}`} · {p.is_public ? s.public : s.private}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 shrink-0 pt-0.5">/{p.persona_id}</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/p/${p.persona_id}?lang=${lang}`}
                    className="flex-1 text-center py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors"
                  >
                    {s.viewFeed}
                  </Link>
                  <button
                    onClick={() => handleDelete(p.persona_id, name)}
                    disabled={deletingId === p.persona_id}
                    className="px-3 py-1.5 rounded-lg border border-red-900/50 hover:bg-red-900/20 text-sm text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deletingId === p.persona_id ? s.deleting : s.delete}
                  </button>
                </div>
              </div>
            )
          })}
          {personas.length >= 3 && (
            <p className="text-center text-xs text-zinc-600 pt-2">{s.maxReached}</p>
          )}
        </div>
      )}
    </main>
  )
}

export default function MyPersonasPage() {
  return (
    <Suspense>
      <MyPersonasContent />
    </Suspense>
  )
}
