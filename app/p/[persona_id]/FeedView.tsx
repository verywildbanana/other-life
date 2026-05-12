'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import Image from 'next/image'
import { FeedPageResponse, Video, Persona } from '@/types'
import { markViewed, getViewedSet } from '@/lib/viewedTracker'
import { useEventQueue } from '@/lib/useEventQueue'

// ── 페이지 전환 Progress Bar ───────────────────────────────────────────────────
function NavigationProgress({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setWidth(15)
      const t1 = setTimeout(() => setWidth(50), 200)
      const t2 = setTimeout(() => setWidth(75), 600)
      const t3 = setTimeout(() => setWidth(90), 1500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      // 완료: 100%로 채운 뒤 페이드아웃
      setWidth(100)
      const t = setTimeout(() => { setVisible(false); setWidth(0) }, 300)
      return () => clearTimeout(t)
    }
  }, [active])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-zinc-800">
      <div
        className="h-full bg-zinc-100 transition-all ease-out"
        style={{
          width: `${width}%`,
          transitionDuration: width === 100 ? '200ms' : width === 15 ? '150ms' : '600ms',
        }}
      />
    </div>
  )
}

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

// ── 페르소나 바텀시트 ──────────────────────────────────────────────────────────
interface PersonaSheetProps {
  personas: import('@/types').Persona[]
  currentId: string
  lang: Lang
  onSelect: (id: string) => void
  onClose: () => void
}

function PersonaBottomSheet({ personas, currentId, lang, onSelect, onClose }: PersonaSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const [hasScrollBelow, setHasScrollBelow] = useState(true)

  // 스크롤 여부 감지 — 하단에 더 내용이 있으면 마스크 표시
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const check = () => {
      setHasScrollBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 마운트 직후 바로 등록하면 열린 클릭이 바깥 클릭으로 판정됨 → 1 tick 지연
    const id = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handleClick) }
  }, [onClose])

  // ESC 닫기
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/60" />

      {/* 시트 */}
      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-xs bg-zinc-900 rounded-t-2xl sm:rounded-2xl
                   border border-zinc-700 shadow-2xl
                   max-h-[60vh] flex flex-col overflow-hidden
                   animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* 핸들 바 (모바일) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {{ ko: '페르소나 선택', en: 'Select Persona', ja: 'ペルソナを選択' }[lang]}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="닫기"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* 목록 */}
        <div
          ref={listRef}
          className="overflow-y-auto flex-1 py-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {personas.map(p => {
            const isActive = p.id === currentId
            const name = p.name_i18n?.[lang] ?? p.name
            return (
              <button
                key={p.id}
                onClick={() => { onSelect(p.id); onClose() }}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors
                  ${isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-300 hover:bg-zinc-800/60'
                  }`}
              >
                <span className={`text-sm truncate ${isActive ? 'font-medium' : ''}`}>{name}</span>
                {isActive && (
                  <svg className="shrink-0 text-zinc-400" width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M1.5 6.5l3.5 3.5 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* 하단 페이드 마스크 — 스크롤 끝에 도달하면 사라짐 (pointer-events-none으로 스크롤 방해 안 함) */}
        {hasScrollBelow && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12
                          bg-gradient-to-t from-zinc-900 to-transparent rounded-b-2xl" />
        )}
      </div>
    </div>
  )
}

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
  aiSummary: {
    ko: 'AI 요약',
    en: 'AI Summary',
    ja: 'AI 要約',
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


// ── VideoCard — memo로 분리해 isPlaying/isHovered 변경 시 해당 카드만 재렌더 ──────
interface VideoCardProps {
  video: Video
  idx: number
  lang: Lang
  today: string
  isPlaying: boolean
  isHovered: boolean
  personaId: string
  onMouseEnter: (videoId: string) => void
  onMouseLeave: () => void
  onVideoClick: (video: Video, title: string, idx: number) => void
}

const VideoCard = memo(function VideoCard({
  video, idx, lang, today, isPlaying, isHovered, personaId,
  onMouseEnter, onMouseLeave, onVideoClick,
}: VideoCardProps) {
  // collected_at(타임스탬프) 기준 FRESH_HOURS 이내면 NEW — 날짜만 비교하면 하루종일 NEW 뱃지가 붙음
  const isNew = video.collected_at
    ? (Date.now() - new Date(video.collected_at).getTime()) < FRESH_HOURS * 3_600_000
    : video.collected_date === today
  const title = getLangTitle(video, lang)
  const dateLabel = video.published_at ?? video.collected_date
  const [summaryOpen, setSummaryOpen] = useState(false)

  // 툴팁 외부 클릭 시 닫기
  useEffect(() => {
    if (!summaryOpen) return
    const close = () => setSummaryOpen(false)
    document.addEventListener('click', close, { once: true })
    return () => document.removeEventListener('click', close)
  }, [summaryOpen])

  // iframe lazy mount + 영구 유지 패턴
  // 첫 재생(isPlaying=true) 또는 hover 시 한 번만 DOM에 추가하고,
  // 이후 isPlaying=false여도 절대 unmount하지 않음.
  // Android Chrome의 compositor 레이어 teardown → 흰 깜박임 방지
  const [iframeActive, setIframeActive] = useState(false)
  useEffect(() => {
    if (isPlaying || isHovered) setIframeActive(true)
  }, [isPlaying, isHovered])

  const showIframe = isPlaying || isHovered

  return (
    <a
      href={video.url}
      title={video.title}
      data-video-id={video.video_id}
      className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      onMouseEnter={() => onMouseEnter(video.video_id)}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        e.preventDefault()
        onVideoClick(video, title, idx)
      }}
    >
      {/* 썸네일 + 미리보기 오버레이
          contain:paint + translateZ(0): GPU 레이어 고정 → iframe 전환 시 부모 레이어 재합성 방지
          isolation:isolate: stacking context 격리 → Android 레이어 재합성 범위 제한 */}
      <div
        className="relative w-full aspect-video bg-zinc-800"
        style={{ contain: 'paint', isolation: 'isolate', transform: 'translateZ(0)' }}
      >
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover"
            priority={idx < 4}
          />
        ) : null}
        {/* iframeActive: 한 번 true가 되면 DOM에서 제거하지 않음 (unmount 자체가 플래시 원인)
            showIframe: opacity + pointer-events로만 show/hide → 레이어 유지
            transition-opacity: 마운트 직후 YouTube 흰 로딩 화면 fade-in으로 완화 */}
        {iframeActive && (
          <iframe
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=${isPlaying ? 1 : 0}&loop=1&playlist=${video.video_id}&modestbranding=1&rel=0`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
              showIframe ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            title={video.title}
          />
        )}
      </div>
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
          <div className="flex items-center gap-1.5 flex-wrap">
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
            {video.summary_i18n && (video.summary_i18n[lang] || video.summary_i18n['en']) && (
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSummaryOpen(v => !v)
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-1.5 py-0.5 rounded transition-colors"
                >
                  {t('aiSummary', lang)}
                </button>
                {summaryOpen && (
                  <div
                    className="absolute bottom-full right-0 mb-1.5 w-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {video.summary_i18n[lang] || video.summary_i18n['en']}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  )
})

// ── ShortCard — 9:16 세로형 카드 ─────────────────────────────────────────
// isPlaying: 모바일 자동재생 (캐로셀 좌측 카드)
// isHovered: 데스크톱 hover 재생
interface ShortCardProps {
  video: Video
  lang: Lang
  isPlaying: boolean
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onCardClick: (video: Video) => void
}

const ShortCard = memo(function ShortCard({
  video, lang, isPlaying, isHovered, onMouseEnter, onMouseLeave, onCardClick,
}: ShortCardProps) {
  const title = getLangTitle(video, lang)
  // VideoCard와 동일한 lazy-mount 패턴 — 한 번 mount 후 절대 unmount 안 함
  const [iframeActive, setIframeActive] = useState(false)
  const showIframe = isPlaying || isHovered
  useEffect(() => {
    if (showIframe) setIframeActive(true)
  }, [showIframe])

  // 앱 복귀 시 iframe 제거 → 썸네일 복원 (YouTube 앱에서 돌아올 때 검은 화면 방지)
  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) setIframeActive(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      data-short-id={video.video_id}
      className="flex-shrink-0 w-36 snap-start group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => { e.preventDefault(); onCardClick(video) }}
    >
      <div
        className="relative w-full aspect-[9/16] bg-zinc-800 rounded-xl overflow-hidden"
        style={{ contain: 'paint', isolation: 'isolate', transform: 'translateZ(0)' }}
      >
        {/* 썸네일 */}
        {video.thumbnail_url && (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="144px"
            className="object-cover"
          />
        )}
        {/* 자동재생 iframe — lazy mount, 음소거 */}
        {iframeActive && (
          <iframe
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${video.video_id}&modestbranding=1&rel=0`}
            className={`absolute inset-0 w-full h-full transition-opacity duration-200 ${
              showIframe ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            title={video.title}
          />
        )}
        {/* Shorts 배지 */}
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          Shorts
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs text-zinc-200 line-clamp-2 leading-tight">{title}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{video.channel}</p>
      </div>
    </a>
  )
})

// ── ShortsCarousel — 수평 스크롤 선반, 최신 콘텐츠가 왼쪽 ─────────────────────
const ShortsCarousel = memo(function ShortsCarousel({
  shorts,
  lang,
  playingId,
  onPlay,
  isMobile,
  hasMore,
  onLoadMore,
  onStopAll,
  onCardClick,
}: {
  shorts: Video[]
  lang: Lang
  playingId: string | null
  onPlay: (id: string | null) => void
  isMobile: boolean
  hasMore: boolean
  onLoadMore: () => void
  onStopAll: () => void
  onCardClick: (video: Video) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isScrolling = useRef(false)

  // 가로 스크롤 끝 감지 — IntersectionObserver (root = 캐로셀 컨테이너)
  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollRef.current
    if (!sentinel || !container || !hasMore) return

    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore() },
      { root: container, rootMargin: '0px 300px 0px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  // 세로 스크롤 재진입 감지는 FeedView의 playCardInZone에서 통합 처리
  // (data-shorts-section 마킹 → playCardInZone이 Shorts 존 체크 후 onPlay 호출)

  // 가로 스크롤 멈춤 감지 → 가장 왼쪽에 보이는 카드 자동재생 (모바일 전용)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // 초기 로드 시 첫 번째 카드 자동재생 — 모바일에서만 (600ms 후 — 렌더 완료 대기)
    const initTimer = setTimeout(() => {
      if (isMobile && shorts.length > 0) onPlay(shorts[0].video_id)
    }, 600)

    // 컨테이너 안에서 오른쪽 끝이 containerLeft 보다 오른쪽에 있는 카드 중 가장 왼쪽 카드 반환
    function findLeftmostVisibleCard(): string | null {
      if (!el) return null
      const containerLeft = el.getBoundingClientRect().left
      const cards = el.querySelectorAll<HTMLElement>('[data-short-id]')
      for (const card of cards) {
        const rect = card.getBoundingClientRect()
        if (rect.right > containerLeft) return card.dataset.shortId ?? null
      }
      return null
    }

    function onScroll() {
      if (!isMobile) return  // 데스크톱은 scroll 자동재생 없음
      // 스크롤 시작 → 재생 중단
      if (!isScrolling.current) {
        isScrolling.current = true
        onPlay(null)
      }
      // 스크롤 멈춤 감지 (600ms debounce)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => {
        isScrolling.current = false
        const id = findLeftmostVisibleCard()
        if (id) onPlay(id)
      }, 600)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(initTimer)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      el.removeEventListener('scroll', onScroll)
    }
  }, [shorts, onPlay, isMobile])

  if (shorts.length === 0) return null

  return (
    <section data-shorts-section className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.77 10.32l-1.2-.5L18 9.06a3.74 3.74 0 00-4.64-5.88L6 7.18H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V13a2.69 2.69 0 00-4.23-2.68zM10 17.18v-6l5 3z"/>
        </svg>
        <h2 className="text-sm font-semibold text-zinc-300">Shorts</h2>
        <span className="text-xs text-zinc-600">{shorts.length}</span>
      </div>
      {/* overflow-x-auto + scrollbar 숨김 + snap */}
      <div
        ref={scrollRef}
        data-shorts-scroll
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {shorts.map(video => (
          <ShortCard
            key={video.video_id}
            video={video}
            lang={lang}
            isPlaying={playingId === video.video_id}
            isHovered={hoveredId === video.video_id}
            onMouseEnter={() => setHoveredId(video.video_id)}
            onMouseLeave={() => setHoveredId(null)}
            onCardClick={onCardClick}
          />
        ))}
        {/* 가로 스크롤 끝 sentinel — has_more일 때만 존재 */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex-shrink-0 flex items-center justify-center w-12 self-stretch"
          >
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </section>
  )
})

// ── 랜덤 순서 유틸 ────────────────────────────────────────────────────────────
const FEED_PAGE = 20
// NEXT_PUBLIC_FRESH_HOURS: 이 시간 이내 수집된 콘텐츠를 신규로 간주 (기본 12시간)
const FRESH_HOURS = Number(process.env.NEXT_PUBLIC_FRESH_HOURS ?? 12)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Epoch 셔플 — 한 번만 실행하고 cursor로 이동 (weightedShuffle 대체)
// 우선순위: fresh+summary > fresh > rest+summary > rest > seen
// viewed: localStorage 시청 이력 → 본 영상은 뒤쪽 seen 버킷으로 패널티
function epochShuffle(videos: Video[], viewed: Set<string>): Video[] {
  const cutoffMs = Date.now() - FRESH_HOURS * 3_600_000
  const freshSummarized: Video[] = []
  const freshRaw: Video[] = []
  const restSummarized: Video[] = []
  const restRaw: Video[] = []
  const seen: Video[] = []

  for (const v of videos) {
    // stt_skip 마킹된 영상은 요약 없는 것으로 취급 (summary_i18n = {stt_skip:true} 형태)
    const hasSummary = v.summary_i18n
      && !v.summary_i18n.stt_skip
      && (v.summary_i18n.ko || v.summary_i18n.en || v.summary_i18n.ja)
    if (viewed.has(v.video_id)) {
      seen.push(v)
    } else if (
      v.collected_at
        ? new Date(v.collected_at).getTime() >= cutoffMs
        : (v.collected_date ?? '') >= new Date(cutoffMs).toISOString().slice(0, 10)
    ) {
      hasSummary ? freshSummarized.push(v) : freshRaw.push(v)
    } else {
      hasSummary ? restSummarized.push(v) : restRaw.push(v)
    }
  }
  return [
    ...shuffle(freshSummarized),
    ...shuffle(freshRaw),
    ...shuffle(restSummarized),
    ...shuffle(restRaw),
    ...shuffle(seen),
  ]
}

interface Props {
  feed: FeedPageResponse | null
  persona: Persona
  allPersonas: Persona[]
}

export default function FeedView({ feed, persona, allPersonas }: Props) {
  const { enqueueEvent } = useEventQueue()

  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ko'
    const saved = localStorage.getItem('feed_lang') as Lang | null
    return (saved && ['ko', 'en', 'ja'].includes(saved)) ? saved : 'ko'
  })
  const [currentPersona, setCurrentPersona] = useState<Persona>(() => {
    if (typeof window === 'undefined') return persona
    const savedId = localStorage.getItem('feed_last_persona')
    if (!savedId) return persona
    return allPersonas.find(p => p.id === savedId) ?? persona
  })
  const [videos, setVideos] = useState<Video[]>([])
  const [hasMore, setHasMore] = useState(false)
  const hasMoreRef = useRef(false)
  const [nextOffset, setNextOffset] = useState(0)
  // nextOffsetRef / hasMoreRef: loadMore useCallback deps에서 state를 제거하기 위해 ref로 동기화
  // state가 deps에 있으면 매 로드마다 loadMore 함수가 교체 → IntersectionObserver 재생성 →
  // sentinel이 이미 뷰포트 안에 있을 때 다음 스크롤까지 발화 안 함 (Read More 동작 안 하는 원인)
  const nextOffsetRef = useRef(0)
  const updateNextOffset = useCallback((v: number) => {
    nextOffsetRef.current = v
    setNextOffset(v)
  }, [])
  const updateHasMore = useCallback((v: boolean) => {
    hasMoreRef.current = v
    setHasMore(v)
  }, [])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  // 초기 클라이언트 fetch 완료 전 로딩 상태
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  // fetch 완료 후 실제 영상이 0개인 경우 — "피드 없음" 표시용 (로딩 중에는 false 유지)
  const [isEmpty, setIsEmpty] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showPersonaSheet, setShowPersonaSheet] = useState(false)
  const [navigating, setNavigating] = useState(false)
  // PTR 완료 후 fade-in 제어 — false: 콘텐츠 숨김(no-transition), true: fade-in(300ms)
  // 초기 진입 시에도 false → 클라이언트 fetch 완료 후 fade-in (SSR flash 방지)
  const [contentReady, setContentReady] = useState(false)
  // hover 미리보기 — 현재 hover 중인 video_id (데스크톱)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 모바일 자동재생 — 두 상태를 분리하되 동시 재생 방지 (하나 set 시 다른 것 null)
  const [shortPlayId, setShortPlayId]     = useState<string | null>(null)
  const [regularPlayId, setRegularPlayId] = useState<string | null>(null)
  // 동기적으로 shortPlayId를 읽기 위한 ref (useEffect 클로저에서 최신값 참조용)
  const shortPlayIdRef = useRef<string | null>(null)
  shortPlayIdRef.current = shortPlayId
  // 포인터 지원 여부 감지 (hover: hover = 데스크톱, hover: none = 터치 기기)
  const [supportsHover, setSupportsHover] = useState(false)
  // 모바일 스크롤 자동재생용 타이머 ref
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 스크롤 중 여부 — setMobilePlayingId(null)을 첫 이벤트에서만 1회 호출하기 위한 가드
  const isScrollingRef = useRef(false)
  // 현재 활성 페르소나 ID를 ref로도 보관 — loadMore가 비동기 완료 시점에 페르소나가 바뀌었는지 확인용
  // localStorage 복원값이 있으면 그걸 우선 사용 (초기 마운트 시 URL 페르소나보다 우선)
  const activePersonaIdRef = useRef<string>(currentPersona.id)
  // 최초 마운트 여부 — 초기 진입 시 localStorage 복원 페르소나를 URL 페르소나로 덮어쓰지 않기 위해 사용
  const isFirstMountRef = useRef<boolean>(true)
  // loadMore 동시 실행 방지 — state는 리렌더 전까지 반영 안 되므로 ref로 동기 가드
  const isLoadingRef = useRef(false)

  // ── 피드 전체 풀 (셔플 후 가상 페이지네이션용) ────────────────────────────────
  const allVideosRef = useRef<Video[]>([])

  // ── Shorts 캐로셀 상태 ────────────────────────────────────────────────────────
  const [shorts, setShorts]                     = useState<Video[]>([])
  const [shortsHasMore, setShortsHasMore]       = useState(false)
  const [shortsNextOffset, setShortsNextOffset] = useState(0)
  const shortsLoadingRef                        = useRef(false)

  // Shorts 재생 콜백 — shortPlayId 갱신 + 일반 피드 재생 중단
  const handleShortsPlay = useCallback((id: string | null) => {
    shortPlayIdRef.current = id  // debounce 클로저에서 동기 참조 가능하도록 즉시 갱신
    setShortPlayId(id)
    if (id !== null) setRegularPlayId(null)
  }, [])

  // 페르소나 변경 시 Shorts 전체 로드 (limit=100) + 랜덤 셔플
  useEffect(() => {
    let cancelled = false
    setShorts([])
    setShortPlayId(null)
    setShortsHasMore(false)
    setShortsNextOffset(0)
    shortsLoadingRef.current = false
    fetch(`/api/feed/shorts/${currentPersona.id}?offset=0&limit=100`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled && d?.videos) {
          const shuffledShorts = epochShuffle(d.videos, getViewedSet())
          shortsOrderCacheRef.current.set(currentPersona.id, shuffledShorts)  // 순서 캐시 저장
          setShorts(shuffledShorts)
          setShortsHasMore(false)
          setShortsNextOffset(d.videos.length)
        }
      })
      .catch(() => {/* 에러 무시 — Shorts 없어도 메인 피드는 정상 동작 */})
    return () => { cancelled = true }
  }, [currentPersona.id])

  // 가로 스크롤 끝 도달 시 다음 페이지 로드
  const loadMoreShorts = useCallback(async () => {
    if (shortsLoadingRef.current || !shortsHasMore) return
    shortsLoadingRef.current = true
    try {
      const res = await fetch(`/api/feed/shorts/${currentPersona.id}?offset=${shortsNextOffset}&limit=10`)
      if (!res.ok) return
      const data = await res.json()
      setShorts(prev => {
        const ids = new Set(prev.map(v => v.video_id))
        const fresh = (data.videos ?? []).filter((v: Video) => !ids.has(v.video_id))
        return [...prev, ...fresh]
      })
      setShortsHasMore(data.has_more ?? false)
      setShortsNextOffset(data.next_offset ?? 0)
    } catch { /* 무시 */ }
    finally { shortsLoadingRef.current = false }
  }, [shortsHasMore, shortsNextOffset, currentPersona.id])

  // ── 피드 캐시 (TTL: 1시간) ─────────────────────────────────────────────────
  const FEED_CACHE_TTL_MS = 60 * 60 * 1000
  type FeedCacheEntry = {
    data: FeedPageResponse
    shuffled: Video[]   // 최초 셔플된 순서 — 페르소나 전환 시 그대로 재사용 (재셔플 없음)
    cachedAt: number
  }
  const feedCacheRef = useRef<Map<string, FeedCacheEntry>>(new Map())
  // Shorts 셔플 순서 캐시 — 페르소나 전환 시 재사용 (feedCacheRef와 별도 관리)
  const shortsOrderCacheRef = useRef<Map<string, Video[]>>(new Map())

  function getCachedFeed(personaId: string): FeedCacheEntry | null {
    const entry = feedCacheRef.current.get(personaId)
    if (!entry) return null
    if (Date.now() - entry.cachedAt > FEED_CACHE_TTL_MS) {
      feedCacheRef.current.delete(personaId)
      return null
    }
    return entry
  }

  function setCachedFeed(personaId: string, data: FeedPageResponse, shuffled: Video[]) {
    feedCacheRef.current.set(personaId, { data, shuffled, cachedAt: Date.now() })
  }

  // ── Pull to Refresh ────────────────────────────────────────────────────────
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullStartYRef = useRef<number | null>(null)
  const PULL_THRESHOLD = 72  // px — 이 이상 당기면 새로고침 트리거

  // 터치 기기 감지 — maxTouchPoints 사용 (hover 미디어쿼리는 Chrome DevTools 에뮬레이션에서도 true라 부정확)
  // maxTouchPoints > 0 이면 터치 기기(실제 모바일 + DevTools 에뮬레이션 모두 정확)
  useEffect(() => {
    const isTouch = navigator.maxTouchPoints > 0
    setSupportsHover(!isTouch)
  }, [])

  // 데스크톱 hover 핸들러
  // useCallback 필수 — 미사용 시 mobilePlayingId/hoveredId 변경마다 새 함수 레퍼런스 생성 →
  // VideoCard memo 무력화 → 전체 카드 리렌더 → 피드 깜박임 발생
  const handleMouseEnter = useCallback((videoId: string) => {
    if (!supportsHover) return
    hoverTimerRef.current = setTimeout(() => setHoveredId(videoId), 600)
  }, [supportsHover])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHoveredId(null)
  }, [])

  // 모바일 스크롤 자동재생 — 스크롤 멈춤 감지 후 뷰포트 중앙 zone의 카드 재생
  // zone: 뷰포트 세로 30~70% (사용자에게 비노출 — 순수 로직용)
  useEffect(() => {
    if (supportsHover) return  // 데스크톱은 hover 방식 사용

    // viewport 상단 10~60% 영역 안에 중심이 있는 카드를 반환
    // 초기 로드 시 첫 번째 카드가 상단에 위치하므로 zoneTop을 0.10으로 설정
    function findCardInZone(): string | null {
      const vh = window.innerHeight
      const zoneTop    = vh * 0.10
      const zoneBottom = vh * 0.60
      const cards = document.querySelectorAll<HTMLElement>('[data-video-id]')
      for (const card of cards) {
        const { top, bottom } = card.getBoundingClientRect()
        const center = (top + bottom) / 2
        if (center >= zoneTop && center <= zoneBottom) {
          return card.getAttribute('data-video-id')
        }
      }
      return null
    }

    function playCardInZone() {
      const vh = window.innerHeight
      const zoneTop    = vh * 0.10
      const zoneBottom = vh * 0.60

      // 1. Shorts 섹션이 활성 존에 있는지 먼저 확인
      const shortsSection = document.querySelector<HTMLElement>('[data-shorts-section]')
      if (shortsSection) {
        const { top, bottom } = shortsSection.getBoundingClientRect()
        const center = (top + bottom) / 2
        if (center >= zoneTop && center <= zoneBottom) {
          // Shorts 섹션이 존 안에 있음 — 현재 가장 왼쪽에 보이는 카드 재생
          const cards = shortsSection.querySelectorAll<HTMLElement>('[data-short-id]')
          const containerEl = shortsSection.querySelector<HTMLElement>('[data-shorts-scroll]')
          const containerLeft = containerEl?.getBoundingClientRect().left ?? 0
          let leftmostId: string | null = null
          for (const card of cards) {
            if (card.getBoundingClientRect().right > containerLeft) {
              leftmostId = card.dataset.shortId ?? null
              break
            }
          }
          if (leftmostId) {
            handleShortsPlay(leftmostId)
            return
          }
        }
      }

      // 2. 일반 영상 존 체크
      const videoId = findCardInZone()
      if (videoId) {
        setShortPlayId(null)
        setRegularPlayId(videoId)
      }
    }

    function onScroll() {
      // 스크롤 첫 이벤트에서만 null 설정 — 매 이벤트마다 호출하면 초당 수십 번 리렌더 → 흰 깜박임
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        shortPlayIdRef.current = null
        setShortPlayId(null)
        setRegularPlayId(null)
      }
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      // 300ms 멈추면 zone 안 카드 재생
      scrollTimerRef.current = setTimeout(() => {
        isScrollingRef.current = false
        playCardInZone()
      }, 300)
    }

    // 초기 로드 시 스크롤 이벤트 없이도 첫 카드를 자동재생
    // 600ms: 피드 카드 DOM 마운트 완료 대기
    // Shorts가 먼저 재생 중이면 일반 피드 자동재생 생략 (두 개 동시 재생 방지)
    const initialTimer = setTimeout(() => {
      if (shortPlayIdRef.current) return  // Shorts가 이미 재생 중 — 일반 피드는 대기
      playCardInZone()
    }, 600)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(initialTimer)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      setRegularPlayId(null)
      setShortPlayId(null)
    }
  // shorts: 제거 — 숏츠 페이지네이션 시 playCardInZone이 재실행되어 현재 재생을 방해하는 것 방지
  }, [supportsHover, videos[0]?.video_id, handleShortsPlay])

  // ── Pull to Refresh — 터치 이벤트 ─────────────────────────────────────────
  useEffect(() => {
    if (supportsHover) return  // 데스크톱에서는 불필요

    async function doRefresh() {
      setIsRefreshing(true)
      feedCacheRef.current.delete(currentPersona.id)  // 캐시 무효화
      const viewed = getViewedSet()
      try {
        // Stage 1: Shorts와 병렬 + 피드 빠른 로드
        const [feedRes, shortsRes] = await Promise.all([
          fetch(`/api/feed/${currentPersona.id}?offset=0&limit=50&skip_count=1`),
          fetch(`/api/feed/shorts/${currentPersona.id}?offset=0&limit=100`),
        ])
        if (!feedRes.ok) throw new Error('fetch failed')

        const data: FeedPageResponse = await feedRes.json()
        const shuffled = epochShuffle(data.videos, viewed)
        const ptrStage1Displayed = shuffled.slice(0, FEED_PAGE)
        allVideosRef.current = shuffled
        setVideos(ptrStage1Displayed)
        updateHasMore(true)  // Stage 2에서 보완
        updateNextOffset(FEED_PAGE)

        // Shorts 재셔플
        if (shortsRes.ok) {
          const shortsData = await shortsRes.json()
          if (shortsData?.videos) {
            const newShorts = epochShuffle(shortsData.videos, viewed)
            stopAllPlayback()
            shortsOrderCacheRef.current.set(currentPersona.id, newShorts)
            setShorts(newShorts)
            setShortsHasMore(false)
            setShortsNextOffset(newShorts.length)
          }
        }

        window.scrollTo({ top: 0, behavior: 'instant' })

        // Stage 2: 백그라운드 풀 로드
        const fullRes = await fetch(`/api/feed/${currentPersona.id}?offset=0&limit=300`)
        if (fullRes.ok) {
          const fullData: FeedPageResponse = await fullRes.json()
          const fullShuffled = epochShuffle(fullData.videos, viewed)
          // Stage 1 표시분 보존 + 나머지 붙임 (dedup 버그 방지)
          const shownIds = new Set(ptrStage1Displayed.map(v => v.video_id))
          const remaining = fullShuffled.filter(v => !shownIds.has(v.video_id))
          allVideosRef.current = [...ptrStage1Displayed, ...remaining]
          updateHasMore(remaining.length > 0)
          setTotal(fullData.total_accumulated ?? fullShuffled.length)
          setCachedFeed(currentPersona.id, fullData, allVideosRef.current)
        }
      } catch { /* 실패 시 현재 피드 유지 */ }
      finally { setIsRefreshing(false) }
    }

    function onTouchStart(e: TouchEvent) {
      // 스크롤이 최상단일 때만 pull 시작
      if (window.scrollY > 0) return
      pullStartYRef.current = e.touches[0].clientY
    }

    function onTouchMove(e: TouchEvent) {
      if (pullStartYRef.current === null) return
      const dist = e.touches[0].clientY - pullStartYRef.current
      if (dist < 0) { pullStartYRef.current = null; return }
      // 최대 100px까지만 당김 (rubber band 효과)
      setPullDistance(Math.min(dist * 0.5, 100))
    }

    function onTouchEnd() {
      if (pullDistance >= PULL_THRESHOLD) doRefresh()
      setPullDistance(0)
      pullStartYRef.current = null
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [supportsHover, pullDistance, currentPersona.id])

  // 서버에서 직접 접근 시 (URL 직접 입력, 새로고침) 전체 풀 로드 + 셔플
  // window.history.pushState 사용으로 Next.js navigation이 트리거되지 않아 이 effect는
  // 초기 마운트 시에만 발동됨 (브라우저 직접 접근 / 새로고침)
  useEffect(() => {
    // 최초 마운트: localStorage에서 복원된 페르소나가 URL 페르소나와 다르면 복원값 사용
    // (setCurrentPersona로 덮어쓰지 않음 — useState 초기화에서 이미 올바른 값 설정됨)
    const isFirst = isFirstMountRef.current
    isFirstMountRef.current = false

    const targetPersona = isFirst ? currentPersona : persona
    if (!isFirst) {
      setCurrentPersona(persona)
      activePersonaIdRef.current = persona.id
    }

    // 최초 마운트 + 복원 페르소나가 URL과 다를 경우 URL을 조용히 교체
    if (isFirst && currentPersona.id !== persona.id) {
      window.history.replaceState(null, '', `/p/${currentPersona.id}`)
    }

    let cancelled = false
    const viewed = getViewedSet()
    // Stage 1에서 실제 표시된 영상 — Stage 2 재조합 시 앞에 보존 (dedup 버그 방지)
    let stage1Displayed: Video[] = []

    // Stage 1: 빠른 첫 화면 (50개, COUNT 스킵)
    fetch(`/api/feed/${targetPersona.id}?offset=0&limit=50&skip_count=1`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.videos) return
        const shuffled = epochShuffle(data.videos, viewed)
        stage1Displayed = shuffled.slice(0, FEED_PAGE)
        allVideosRef.current = shuffled
        setVideos(stage1Displayed)
        updateHasMore(true)  // Stage 2에서 더 로드될 예정
        updateNextOffset(FEED_PAGE)
        setIsEmpty(false)
        setIsInitialLoading(false)
        setContentReady(true)

        // Stage 2: 백그라운드 풀 로드 (300개, COUNT 포함)
        return fetch(`/api/feed/${targetPersona.id}?offset=0&limit=300`)
      })
      .then(r => r?.ok ? r.json() : null)
      .then(fullData => {
        if (cancelled || !fullData?.videos) return
        const fullShuffled = epochShuffle(fullData.videos, viewed)
        // Stage 1 표시분을 앞에 보존 + 나머지를 뒤에 붙임 → loadMore가 slice(20~)부터 읽으면 중복 없음
        const shownIds = new Set(stage1Displayed.map(v => v.video_id))
        const remaining = fullShuffled.filter(v => !shownIds.has(v.video_id))
        allVideosRef.current = [...stage1Displayed, ...remaining]
        updateHasMore(remaining.length > 0)
        setTotal(fullData.total_accumulated ?? fullShuffled.length)
        setIsEmpty(fullShuffled.length === 0)
        setCachedFeed(targetPersona.id, fullData, allVideosRef.current)
      })
      .catch(() => { setIsInitialLoading(false); setContentReady(true) })
    return () => { cancelled = true }
  }, [persona.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // 클라이언트사이드 페르소나 전환 (새로고침 없음)
  const switchPersona = useCallback(async (nextPersonaId: string) => {
    const nextPersona = allPersonas.find(p => p.id === nextPersonaId)
    if (!nextPersona || nextPersonaId === currentPersona.id) return

    gtag('persona_switch', { from: currentPersona.id, to: nextPersonaId, lang })

    // 마지막 선택 페르소나 저장
    localStorage.setItem('feed_last_persona', nextPersonaId)

    // ref 즉시 갱신 — inflight loadMore가 응답 도착 시 stale 체크로 결과를 버리게 함
    activePersonaIdRef.current = nextPersonaId

    setCurrentPersona(nextPersona)
    window.history.pushState(null, '', `/p/${nextPersonaId}`)

    // 캐시 히트 — 저장된 셔플 순서 그대로 표시 (재셔플 없음 → 전환 시 순서 안정)
    const cached = getCachedFeed(nextPersonaId)
    if (cached) {
      allVideosRef.current = cached.shuffled
      setVideos(cached.shuffled.slice(0, FEED_PAGE))
      updateHasMore(cached.shuffled.length > FEED_PAGE)
      updateNextOffset(FEED_PAGE)
      setTotal(cached.data.total_accumulated)
      setIsEmpty(cached.shuffled.length === 0)
      // Shorts 캐시 히트 시 재사용 (없으면 useEffect가 별도 fetch)
      const cachedShorts = shortsOrderCacheRef.current.get(nextPersonaId)
      if (cachedShorts && cachedShorts.length > 0) {
        setShorts(cachedShorts)
        setShortsHasMore(false)
        setShortsNextOffset(cachedShorts.length)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // 캐시 미스 — 2단계 fetch
    setVideos([])
    updateHasMore(false)
    updateNextOffset(0)
    setNavigating(true)
    const viewed = getViewedSet()

    try {
      // Stage 1: 빠른 첫 화면
      const res = await fetch(`/api/feed/${nextPersonaId}?offset=0&limit=50&skip_count=1`)
      if (!res.ok) throw new Error('fetch failed')
      const data: FeedPageResponse = await res.json()

      const shuffled = epochShuffle(data.videos, viewed)
      allVideosRef.current = shuffled
      setVideos(shuffled.slice(0, FEED_PAGE))
      updateHasMore(true)
      updateNextOffset(FEED_PAGE)
      setIsEmpty(false)
      setNavigating(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Stage 2: 백그라운드 풀 로드
      const fullRes = await fetch(`/api/feed/${nextPersonaId}?offset=0&limit=300`)
      if (fullRes.ok) {
        const fullData: FeedPageResponse = await fullRes.json()
        const fullShuffled = epochShuffle(fullData.videos, viewed)
        // Stage 1 표시분 보존 + 나머지 붙임 (dedup 버그 방지)
        const shownIds = new Set(shuffled.slice(0, FEED_PAGE).map(v => v.video_id))
        const remaining = fullShuffled.filter(v => !shownIds.has(v.video_id))
        allVideosRef.current = [...shuffled.slice(0, FEED_PAGE), ...remaining]
        setCachedFeed(nextPersonaId, fullData, allVideosRef.current)
        updateHasMore(remaining.length > 0)
        setTotal(fullData.total_accumulated ?? fullShuffled.length)
        setIsEmpty(fullShuffled.length === 0)
      }
    } catch {
      window.location.href = `/p/${nextPersonaId}`
    } finally {
      setNavigating(false)
    }
  }, [currentPersona.id, allPersonas, lang])

  const loadMore = useCallback(() => {
    // isLoadingRef: 동기 가드 — IntersectionObserver 중복 발화 방지
    if (isLoadingRef.current || !hasMoreRef.current) return
    isLoadingRef.current = true
    setIsLoading(true)

    // nextOffsetRef로 최신 offset 읽기 — state(nextOffset)를 deps에서 제거해
    // loadMore 함수가 교체되지 않으므로 IntersectionObserver 재생성이 없음
    const currentOffset = nextOffsetRef.current
    const next = allVideosRef.current.slice(currentOffset, currentOffset + FEED_PAGE)
    if (next.length > 0) {
      setVideos(prev => {
        const ids = new Set(prev.map(v => v.video_id))
        return [...prev, ...next.filter(v => !ids.has(v.video_id))]
      })
      const newOffset = currentOffset + next.length
      updateNextOffset(newOffset)
      updateHasMore(newOffset < allVideosRef.current.length)
      gtag('infinite_scroll_load', { persona_id: currentPersona.id, offset: currentOffset, loaded: next.length })
      enqueueEvent({ type: 'scroll_load', persona_id: currentPersona.id, scroll_page: Math.floor(currentOffset / FEED_PAGE) + 1, lang })
    } else {
      updateHasMore(false)
    }

    isLoadingRef.current = false
    setIsLoading(false)
  }, [currentPersona.id, updateNextOffset, updateHasMore])

  // sentinelRef: callback ref — DOM에 붙는 순간 Observer 자동 연결
  // useRef + useEffect 방식은 sentinel이 조건부 렌더링될 때 effect 재실행 안 됨 → Read More 불작동
  // callback ref는 element mount/unmount 시 즉시 호출 → 항상 올바르게 Observer 연결/해제
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (sentinelObserverRef.current) {
      sentinelObserverRef.current.disconnect()
      sentinelObserverRef.current = null
    }
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    sentinelObserverRef.current = observer
  }, [loadMore])

  // 비디오 클릭 핸들러 — useCallback으로 메모이제이션해 VideoCard 불필요한 재렌더 방지
  const stopAllPlayback = useCallback(() => {
    shortPlayIdRef.current = null
    setShortPlayId(null)
    setRegularPlayId(null)
  }, [])

  // Shorts 클릭 — 모바일에서 YouTube 앱으로 열기 (일반 피드 handleVideoClick과 동일 딥링크 로직)
  const handleShortsClick = useCallback((video: Video) => {
    stopAllPlayback()
    markViewed(video.video_id)
    gtag('shorts_click', { video_id: video.video_id, persona_id: currentPersona.id, lang })
    enqueueEvent({ type: 'shorts_click', persona_id: currentPersona.id, video_id: video.video_id, lang })
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) {
      // iOS: youtube.com은 Universal Links로 등록돼 네이티브 앱이 가로챔
      // m.youtube.com 서브도메인은 Universal Links 미등록 → Safari에서 직접 열림
      window.location.href = `https://m.youtube.com/shorts/${video.video_id}`
    } else if (isAndroid) {
      window.location.href = `intent://www.youtube.com/shorts/${video.video_id}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https://www.youtube.com/shorts/${video.video_id};end`
    } else {
      window.open(`https://www.youtube.com/shorts/${video.video_id}`, '_blank')
    }
  }, [currentPersona.id, lang, stopAllPlayback])

  const handleVideoClick = useCallback((video: Video, title: string, idx: number) => {
    stopAllPlayback()  // 클릭 시 현재 재생 즉시 중단
    markViewed(video.video_id)
    gtag('video_click', {
      video_id: video.video_id,
      video_title: title,
      persona_id: currentPersona.id,
      position: idx + 1,
      lang,
    })
    enqueueEvent({ type: 'video_click', persona_id: currentPersona.id, video_id: video.video_id, position: idx + 1, lang })
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) {
      // iOS: youtube.com은 Universal Links로 등록돼 네이티브 앱이 가로챔
      // m.youtube.com 서브도메인은 Universal Links 미등록 → Safari에서 직접 열림
      window.location.href = `https://m.youtube.com/watch?v=${video.video_id}`
    } else if (isAndroid) {
      window.location.href = `intent://www.youtube.com/watch?v=${video.video_id}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https://www.youtube.com/watch?v=${video.video_id};end`
    } else {
      window.open(video.url, '_blank')
    }
  }, [currentPersona.id, lang, stopAllPlayback])

  // 탭 숨김/복귀 감지 — 숨김 시 재생 중단, 복귀 시 재생 안 함 (중복 재생 방지)
  useEffect(() => {
    if (supportsHover) return  // 데스크톱은 hover 방식이므로 불필요
    function onVisibility() {
      if (document.hidden) {
        stopAllPlayback()
      }
      // 복귀 시에는 자동 재생 안 함 — 사용자가 다시 스크롤할 때 playCardInZone이 처리
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [supportsHover, stopAllPlayback])

  // IntersectionObserver는 sentinelRef callback ref 안에서 직접 처리됨 (위 sentinelRef 정의 참조)

  function switchLang(l: Lang) {
    gtag('language_switch', { from: lang, to: l, persona_id: currentPersona.id })
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {/* 페이지 전환 Progress Bar */}
      <NavigationProgress active={navigating} />

      {/* Pull to Refresh 인디케이터 */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center items-end pointer-events-none"
          style={{ height: isRefreshing ? 48 : pullDistance }}
        >
          <div className={`mb-2 flex items-center gap-2 text-xs text-zinc-400 transition-opacity ${
            pullDistance >= PULL_THRESHOLD || isRefreshing ? 'opacity-100' : 'opacity-60'
          }`}>
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('loading', lang)}
              </>
            ) : (
              <span>{pullDistance >= PULL_THRESHOLD ? '↑ 놓으면 새로고침' : '↓ 당겨서 새로고침'}</span>
            )}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="border-b border-zinc-800 px-4 py-3 sticky top-0 bg-zinc-950 z-10">
        <div className="flex items-center justify-between mb-2">
          <a href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/anomess-logo.png"
              alt="Anomess"
              className="h-[66px] w-auto rounded-xl"
            />
          </a>
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

        {/* 페르소나 선택 버튼 */}
        <button
          onClick={() => setShowPersonaSheet(true)}
          className="w-full flex items-center justify-between gap-2
                     bg-zinc-800 border border-zinc-700 hover:border-zinc-500
                     text-sm text-zinc-100 rounded-lg px-3 py-1.5
                     transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-500"
          aria-label={t('selectPersona', lang)}
        >
          <span className="truncate">{getPersonaName(currentPersona, lang)}</span>
          <svg className="shrink-0 text-zinc-400" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </header>

      {/* 상태 바 */}
      {videos.length > 0 && (
        <div className="px-4 py-2 text-xs text-zinc-400 border-b border-zinc-800">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span>
              {getPersonaName(currentPersona, lang)} · {(LABELS.accumulated[lang] as (n: number) => string)(total)}
            </span>
            <span className="text-zinc-600">
              {(LABELS.showing[lang] as (n: number, total: number) => string)(videos.length, total)}
            </span>
          </div>
        </div>
      )}

      {/* 초기 로딩 스피너 */}
      {isInitialLoading && (
        <div className="flex items-center justify-center py-32 gap-2 text-zinc-500 text-sm">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {t('loading', lang)}
        </div>
      )}

      {/* 피드 없음 — fetch 완료 후 실제로 영상 0개일 때만 */}
      {isEmpty && (
        <div className="flex items-center justify-center py-32 text-zinc-500 text-sm">
          {t('noFeed', lang)}
        </div>
      )}

      {/* 피드 그리드 */}
      {!isInitialLoading && videos.length > 0 && (
        <main
          className="px-6 py-6 max-w-7xl mx-auto"
          style={{
            opacity: contentReady ? 1 : 0,
            transition: contentReady ? 'opacity 300ms ease' : 'none',
          }}
        >
          {/* Shorts 캐로셀 — 수평 스크롤, 최신 콘텐츠가 왼쪽 */}
          <ShortsCarousel
            shorts={shorts}
            lang={lang}
            playingId={shortPlayId}
            onPlay={handleShortsPlay}
            isMobile={!supportsHover}
            hasMore={shortsHasMore}
            onLoadMore={loadMoreShorts}
            onStopAll={stopAllPlayback}
            onCardClick={handleShortsClick}
          />

          {videos.length === 0 && !navigating && (
            <p className="text-zinc-500 text-sm text-center py-16">{t('noResults', lang)}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video, idx) => (
              <VideoCard
                key={video.video_id}
                video={video}
                idx={idx}
                lang={lang}
                today={today}
                isPlaying={regularPlayId === video.video_id}
                isHovered={hoveredId === video.video_id}
                personaId={currentPersona.id}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onVideoClick={handleVideoClick}
              />
            ))}
          </div>

          {/* 무한 스크롤 sentinel — 항상 DOM에 유지해야 Observer가 작동함
               hasMore 조건부 렌더링 시: hasMore=false → sentinel 미마운트 → Observer 미설정
               → hasMore=true가 돼도 Observer가 재실행 안 됨 → Read More 영구 불작동 */}
          <div ref={sentinelRef} className="flex justify-center py-8">
            {isLoading && hasMore && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('loading', lang)}
              </div>
            )}
          </div>
        </main>
      )}

      {/* 피드백 플로팅 버튼 */}
      <button
        onClick={() => {
          gtag('feedback_click', { persona_id: currentPersona.id, lang })
          setShowFeedback(true)
        }}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-lg border border-zinc-700 transition-colors"
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
          personaId={currentPersona.id}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showPersonaSheet && (
        <PersonaBottomSheet
          personas={allPersonas}
          currentId={currentPersona.id}
          lang={lang}
          onSelect={switchPersona}
          onClose={() => setShowPersonaSheet(false)}
        />
      )}
    </>
  )
}
