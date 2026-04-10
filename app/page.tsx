'use client'

import { useEffect, useRef, useState } from 'react'
import { Persona, Video, FeedResponse } from '@/types'

type Lang = 'ko' | 'en' | 'ja'

function getLangTitle(video: Video, lang: Lang): string {
  const i18n = video.titles_i18n ?? {}
  const en = (i18n.en as string) || video.title
  if (lang === 'ko') return (i18n.ko as string) || en
  if (lang === 'ja') return (i18n.ja as string) || en
  return en
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-zinc-400'
}

export default function FeedPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [feed, setFeed] = useState<FeedResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('ko')
  const initialized = useRef(false)

  // 언어 초기화
  useEffect(() => {
    const saved = localStorage.getItem('feed_lang') as Lang | null
    if (saved) setLang(saved)
  }, [])

  // 페르소나 로드
  useEffect(() => {
    fetch('/api/personas')
      .then(r => r.json())
      .then(data => {
        const list: Persona[] = data.personas ?? []
        setPersonas(list)

        const saved = localStorage.getItem('persona_feed_last')
        const target = list.find(p => p.id === saved) ? saved! : list[0]?.id
        if (target) {
          setSelectedId(target)
          initialized.current = true
        }
      })
      .catch(() => setError('API 서버에 연결할 수 없습니다.'))
  }, [])

  // 피드 로드 (selectedId 변경 시)
  useEffect(() => {
    if (!selectedId) return
    localStorage.setItem('persona_feed_last', selectedId)
    setLoading(true)
    setError(null)
    setFeed(null)

    fetch(`/api/feed/${selectedId}`)
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.error || `오류: ${r.status}`)
        }
        return r.json()
      })
      .then((data: FeedResponse) => setFeed(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedId])

  function switchLang(l: Lang) {
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

  // 날짜별 영상 flat 전개 (최신 우선)
  const allVideos: (Video & { date: string; feed_source: string })[] = []
  for (const group of feed?.dates ?? []) {
    for (const v of group.videos) {
      allVideos.push({ ...v, date: group.date, feed_source: group.feed_source })
    }
  }
  allVideos.sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1
    return (b.collected_at ?? '') > (a.collected_at ?? '') ? 1 : -1
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {/* 헤더 */}
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950 z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Persona Feed</h1>
            <p className="text-[11px] text-zinc-500 leading-tight">알고리즘 시뮬레이터 POC</p>
          </div>
          {/* 언어 토글 */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs font-medium shrink-0">
            {(['ko', 'en', 'ja'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`px-2.5 py-1.5 ${
                  lang === l
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 페르소나 선택 */}
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">페르소나 선택...</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* 상태 바 */}
      {feed && (
        <div className="px-4 py-2 text-xs text-zinc-400 border-b border-zinc-800">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span>
              {feed.persona_name} · 누적 {feed.total_accumulated}/500개
            </span>
            {feed.dates[0] && (
              <span className="text-zinc-600">
                최근 갱신: {feed.dates[0].date} ({feed.dates[0].feed_source}{' '}
                {feed.dates[0].videos.length}개)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mx-6 mt-4 bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mb-4" />
          <p className="text-sm">피드 불러오는 중...</p>
        </div>
      )}

      {/* 피드 그리드 */}
      {!loading && (
        <main className="px-6 py-6 max-w-7xl mx-auto">
          {allVideos.length === 0 && !error && !loading && feed && (
            <p className="text-zinc-500 text-sm text-center py-16">결과 없음</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allVideos.map((video, idx) => {
              const isNew = video.date === today
              const title = getLangTitle(video, lang)
              return (
                <a
                  key={video.video_id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={video.title}
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                >
                  {video.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail_url}
                      alt=""
                      className="w-full aspect-video object-cover bg-zinc-800"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs">
                      썸네일 없음
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium leading-snug line-clamp-2 mb-1.5">{title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 truncate max-w-[70%]">
                        {video.channel}
                      </span>
                      <span className={`text-xs font-semibold ${scoreColor(video.score)}`}>
                        {video.score}점
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`text-[10px] font-bold ${idx < 3 ? 'text-amber-400' : 'text-zinc-600'}`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded truncate">
                        {video.feed_source === 'home_feed' ? '홈피드' : video.keyword ?? ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {isNew && (
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">
                          NEW
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          video.feed_source === 'home_feed'
                            ? 'bg-purple-900 text-purple-200'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {video.feed_source === 'home_feed' ? 'Home Feed' : 'Search'}
                      </span>
                      <span className="text-[10px] text-zinc-500">{video.date}</span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </main>
      )}
    </>
  )
}
