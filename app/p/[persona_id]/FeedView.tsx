'use client'

import { useState, useEffect } from 'react'
import { FeedResponse, Video, Persona } from '@/types'

type Lang = 'ko' | 'en' | 'ja'

// UI 레이블 다국어 맵
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
  lastUpdated: {
    ko: '최근 갱신',
    en: 'Last updated',
    ja: '最終更新',
  },
  countSuffix: {
    ko: (n: number) => `${n}개`,
    en: (n: number) => `${n} videos`,
    ja: (n: number) => `${n}件`,
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
  feed: FeedResponse | null
  persona: Persona
  allPersonas: Persona[]
}

export default function FeedView({ feed, persona, allPersonas }: Props) {
  const [lang, setLang] = useState<Lang>('ko')

  // 언어 설정 복원 (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('feed_lang') as Lang | null
    if (saved && ['ko', 'en', 'ja'].includes(saved)) setLang(saved)
  }, [])

  function switchLang(l: Lang) {
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

  // 날짜별 영상 flat 전개 (최신 우선)
  const allVideos: (Video & { date: string })[] = []
  for (const group of feed?.dates ?? []) {
    for (const v of group.videos) {
      allVideos.push({ ...v, date: group.date })
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

        {/* 페르소나 선택 (다른 페르소나로 이동) */}
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
              {getPersonaName(persona, lang)} · {(LABELS.accumulated[lang] as (n: number) => string)(feed.total_accumulated)}
            </span>
            {feed.dates[0] && (
              <span className="text-zinc-600">
                {t('lastUpdated', lang)}: {feed.dates[0].date} ({(LABELS.countSuffix[lang] as (n: number) => string)(feed.dates[0].videos.length)})
              </span>
            )}
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
          {allVideos.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-16">{t('noResults', lang)}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allVideos.map((video, idx) => {
              const isNew = video.date === today
              const title = getLangTitle(video, lang)
              const feedSourceLabel = video.feed_source === 'home_feed'
                ? t('homeFeed', lang)
                : (video.keyword ?? t('search', lang))
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
                    {/* SEO: data-ko/en/ja 속성에 번역 제목 모두 포함 → 크롤러가 읽을 수 있음 */}
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
