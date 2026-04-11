'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FeedPageResponse, Video, Persona } from '@/types'

type Lang = 'ko' | 'en' | 'ja'

const LABELS = {
  subtitle: {
    ko: 'YouTube 알고리즘 시뮬레이터',
    en: 'YouTube Algorithm Simulator',
    ja: 'YouTubeアルゴリズム シミュレーター',
  },
  selectPersona: {
    ko: '페르소나 선택',
    en: 'Select Persona',
    ja: 'ペルソナを選択',
  },
  langToggle: {
    ko: '언어 변경',
    en: 'Switch language',
    ja: '言語を変更',
  },
  accumulated: {
    ko: (n: number) => `누적 ${n}/500개`,
    en: (n: number) => `${n}/500 videos`,
    ja: (n: number) => `累計 ${n}/500件`,
  },
  showing: {
    ko: (n: number, total: number) => `${n} / ${total}개 표시 중`,
    en: (n: number, total: number) => `Showing ${n} of ${total}`,
    ja: (n: number, total: number) => `${n} / ${total}件表示中`,
  },
  loading: {
    ko: '불러오는 중...',
    en: 'Loading...',
    ja: '読み込み中...',
  },
  published: {
    ko: '업로드',
    en: 'uploaded',
    ja: '投稿',
  },
  collected: {
    ko: '수집',
    en: 'collected',
    ja: '収集',
  },
  noFeed: {
    ko: '아직 수집된 피드가 없습니다.',
    en: 'No feed collected yet.',
    ja: 'まだフィードが収集されていません。',
  },
  noResults: {
    ko: '결과 없음',
    en: 'No results',
    ja: '結果なし',
  },
  noThumbnail: {
    ko: '썸네일 없음',
    en: 'No thumbnail',
    ja: 'サムネイルなし',
  },
  scoreSuffix: {
    ko: (n: number) => `${n}점`,
    en: (n: number) => `${n}pts`,
    ja: (n: number) => `${n}点`,
  },
  homeFeed: {
    ko: '홈피드',
    en: 'Home',
    ja: 'ホーム',
  },
  search: {
    ko: '검색',
    en: 'Search',
    ja: '検索',
  },
} as const

function t(key: keyof typeof LABELS, lang: Lang): string {
  const val = LABELS[key][lang]
  return typeof val === 'function' ? '' : (val as string)
}

function getLangTitle(video: Video, lang: Lang): string {
  const i18n = video.titles_i18n ?? {}
  const en = (i18n.en as string) || video.title
  if (lang === 'ko') return (i18n.ko as string) || en
  if (lang === 'ja') return (i18n.ja as string) || en
  return en
}

function getPersonaName(persona: Persona, lang: Lang): string {
  return persona.name_i18n?.[lang] ?? persona.name
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-zinc-400'
}

interface Props {
  feed: FeedPageResponse | null
  persona: Persona
  allPersonas: Persona[]
}

export default function FeedView({ feed, persona, allPersonas }: Props) {
  const [lang, setLang] = useState<Lang>('ko')
  const [videos, setVideos] = useState<Video[]>(feed?.videos ?? [])
  const [hasMore, setHasMore] = useState(feed?.has_more ?? false)
  const [nextOffset, setNextOffset] = useState(feed?.next_offset ?? 0)
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(feed?.total_accumulated ?? 0)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 언어 설정 복원 (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('feed_lang') as Lang | null
    if (saved && ['ko', 'en', 'ja'].includes(saved)) setLang(saved)
  }, [])

  // 페르소나 변경 시 리셋
  useEffect(() => {
    setVideos(feed?.videos ?? [])
    setHasMore(feed?.has_more ?? false)
    setNextOffset(feed?.next_offset ?? 0)
    setTotal(feed?.total_accumulated ?? 0)
  }, [feed, persona.id])

  // IntersectionObserver — sentinel이 뷰포트에 들어오면 자동 로드
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' }, // 바닥에서 200px 전에 미리 로드
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  function switchLang(l: Lang) {
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/feed/${persona.id}?offset=${nextOffset}&limit=20`)
      if (!res.ok) return
      const data: FeedPageResponse = await res.json()
      setVideos(prev => [...prev, ...data.videos])
      setHasMore(data.has_more)
      setNextOffset(data.next_offset)
      setTotal(data.total_accumulated)
    } catch {
      // 에러 무시 (네트워크 오류 등)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, nextOffset, persona.id])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {/* 헤더 */}
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950 z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              <a href="/" className="hover:text-zinc-300">Persona Feed</a>
            </h1>
            <p className="text-[11px] text-zinc-500 leading-tight">
              {t('subtitle', lang)}
            </p>
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
                aria-label={`${t('langToggle', lang)}: ${l.toUpperCase()}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 페르소나 선택 */}
        <div className="flex items-center gap-2">
          <select
            value={persona.id}
            onChange={e => { window.location.href = `/p/${e.target.value}` }}
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            aria-label={t('selectPersona', lang)}
          >
            {allPersonas.map(p => (
              <option key={p.id} value={p.id}>
                {getPersonaName(p, lang)}
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
              {getPersonaName(persona, lang)} · {(LABELS.accumulated[lang] as (n: number) => string)(total)}
            </span>
            <span className="text-zinc-600">
              {(LABELS.showing[lang] as (n: number, total: number) => string)(videos.length, total)}
            </span>
          </div>
        </div>
      )}

      {/* 피드 없음 */}
      {!feed && (
        <div className="flex items-center justify-center py-32 text-zinc-500 text-sm">
          {t('noFeed', lang)}
        </div>
      )}

      {/* 피드 그리드 */}
      {feed && (
        <main className="px-6 py-6 max-w-7xl mx-auto">
          {videos.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-16">{t('noResults', lang)}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video, idx) => {
              const isNew = video.collected_date === today
              const title = getLangTitle(video, lang)
              const feedSourceLabel = video.feed_source === 'home_feed'
                ? t('homeFeed', lang)
                : (video.keyword ?? t('search', lang))
              const dateLabel = video.published_at ?? video.collected_date
              return (
                <a
                  key={video.video_id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={video.title}
                  className="block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                  onClick={() => {
                    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
                      ;(window as any).gtag('event', 'video_click', {
                        video_id: video.video_id,
                        video_title: title,
                        persona_id: persona.id,
                        position: idx + 1,
                        feed_source: video.feed_source,
                        lang,
                      })
                    }
                  }}
                >
                  {video.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full aspect-video object-cover bg-zinc-800"
                      loading={idx < 8 ? 'eager' : 'lazy'}
                    />
                  ) : (
                    <div className="w-full aspect-video bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs">
                      {t('noThumbnail', lang)}
                    </div>
                  )}
                  <div className="p-3">
                    <p
                      className="text-sm font-medium leading-snug line-clamp-2 mb-1.5"
                      data-ko={video.titles_i18n?.ko || video.title}
                      data-en={video.titles_i18n?.en || video.title}
                      data-ja={video.titles_i18n?.ja || video.title}
                    >
                      {title}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 truncate max-w-[70%]">
                        {video.channel}
                      </span>
                      <span className={`text-xs font-semibold ${scoreColor(video.score)}`}>
                        {(LABELS.scoreSuffix[lang] as (n: number) => string)(video.score)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-bold ${idx < 3 ? 'text-amber-400' : 'text-zinc-600'}`}>
                        #{idx + 1}
                      </span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded truncate">
                        {feedSourceLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {isNew && (
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">
                          NEW
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        video.feed_source === 'home_feed'
                          ? 'bg-purple-900 text-purple-200'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {video.feed_source === 'home_feed' ? 'Home Feed' : 'Search'}
                      </span>
                      {dateLabel && (
                        <span
                          className={`text-[10px] ${video.published_at ? 'text-zinc-400' : 'text-zinc-600'}`}
                          title={video.published_at
                            ? `${t('published', lang)}: ${video.published_at}`
                            : `${t('collected', lang)}: ${video.collected_date}`}
                        >
                          {dateLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>

          {/* 무한 스크롤 sentinel + 로딩 인디케이터 */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              {isLoading && (
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t('loading', lang)}
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </>
  )
}
