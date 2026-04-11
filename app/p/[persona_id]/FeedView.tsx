'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FeedPageResponse, Video, Persona } from '@/types'

// ── 피드백 모달 컴포넌트 ──────────────────────────────────────────────────────
interface FeedbackModalProps {
  lang: Lang
  personaId: string
  onClose: () => void
}

const FEEDBACK_LABELS = {
  title: { ko: '피드백 남기기', en: 'Leave Feedback', ja: 'フィードバック' },
  ratingLabel: { ko: '서비스는 어떠셨나요?', en: 'How was your experience?', ja: 'ご感想をお聞かせください' },
  commentPlaceholder: { ko: '의견을 자유롭게 남겨주세요 (선택)', en: 'Share your thoughts (optional)', ja: 'ご意見をお聞かせください（任意）' },
  submit: { ko: '제출', en: 'Submit', ja: '送信' },
  submitting: { ko: '제출 중...', en: 'Submitting...', ja: '送信中...' },
  thanks: { ko: '감사합니다! 소중한 의견이 반영됩니다.', en: 'Thank you for your feedback!', ja: 'ご意見ありがとうございます！' },
  close: { ko: '닫기', en: 'Close', ja: '閉じる' },
}

function FeedbackModal({ lang, personaId, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')

  async function handleSubmit() {
    if (rating === 0) return
    setStatus('submitting')
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: personaId, rating, comment, lang }),
      })
      setStatus('done')
      setTimeout(onClose, 2000)
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {status === 'done' ? (
          <p className="text-center text-sm text-emerald-400 py-4">{FEEDBACK_LABELS.thanks[lang]}</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{FEEDBACK_LABELS.title[lang]}</h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-zinc-400 mb-3">{FEEDBACK_LABELS.ratingLabel[lang]}</p>
            {/* 별점 */}
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className={`text-2xl transition-transform hover:scale-110 ${
                    n <= (hovered || rating) ? 'text-amber-400' : 'text-zinc-600'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {/* 코멘트 */}
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={FEEDBACK_LABELS.commentPlaceholder[lang]}
              maxLength={500}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500 mb-4"
            />
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || status === 'submitting'}
              className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg text-sm hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? FEEDBACK_LABELS.submitting[lang] : FEEDBACK_LABELS.submit[lang]}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

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
  feedback: {
    ko: '피드백',
    en: 'Feedback',
    ja: 'フィードバック',
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

// GA4 이벤트 전송 헬퍼
function gtag(event: string, params: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    ;(window as any).gtag('event', event, params)
  }
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
  const [showFeedback, setShowFeedback] = useState(false)
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
      gtag('infinite_scroll_load', { persona_id: persona.id, offset: nextOffset, loaded: data.videos.length })
    } catch {
      // 에러 무시 (네트워크 오류 등)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, nextOffset, persona.id])

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
    gtag('language_switch', { from: lang, to: l, persona_id: persona.id })
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

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
            onChange={e => {
              gtag('persona_switch', { from: persona.id, to: e.target.value, lang })
              window.location.href = `/p/${e.target.value}`
            }}
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
              const dateLabel = video.published_at ?? video.collected_date
              return (
                <a
                  key={video.video_id}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={video.title}
                  className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                  onClick={() => gtag('video_click', {
                    video_id: video.video_id,
                    video_title: title,
                    persona_id: persona.id,
                    position: idx + 1,
                    lang,
                  })}
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
                  <div className="p-3 flex flex-col flex-1">
                    <p
                      className="text-sm font-medium leading-snug line-clamp-2 mb-1.5 flex-1"
                      data-ko={video.titles_i18n?.ko || video.title}
                      data-en={video.titles_i18n?.en || video.title}
                      data-ja={video.titles_i18n?.ja || video.title}
                    >
                      {title}
                    </p>
                    <div className="mt-auto pt-2">
                      <span className="text-xs text-zinc-500 truncate block max-w-full mb-1.5">
                        {video.channel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isNew && (
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">
                            NEW
                          </span>
                        )}
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

      {/* 피드백 플로팅 버튼 */}
      <button
        onClick={() => {
          gtag('feedback_click', { persona_id: persona.id, lang })
          setShowFeedback(true)
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-zinc-700 transition-colors"
        aria-label={t('feedback', lang)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.83L3 20l1.09-3.27C3.4 15.46 3 13.77 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {t('feedback', lang)}
      </button>

      {/* 피드백 모달 */}
      {showFeedback && (
        <FeedbackModal
          lang={lang}
          personaId={persona.id}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </>
  )
}
