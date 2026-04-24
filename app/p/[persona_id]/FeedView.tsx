'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { FeedPageResponse, Video, Persona } from '@/types'

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
  const isNew = video.collected_date === today
  const title = getLangTitle(video, lang)
  const dateLabel = video.published_at ?? video.collected_date

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
      {/* 썸네일 + 미리보기 오버레이 — 썸네일을 항상 뒤에 유지해 iframe 로딩 중 깜박임 방지 */}
      <div className="relative w-full aspect-video bg-zinc-800">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading={idx < 8 ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
            {t('noThumbnail', lang)}
          </div>
        )}
        {(isHovered || isPlaying) && (
          <iframe
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=${isPlaying ? 1 : 0}&loop=1&playlist=${video.video_id}&modestbranding=1&rel=0`}
            className="absolute inset-0 w-full h-full"
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
})

interface Props {
  feed: FeedPageResponse | null
  persona: Persona
  allPersonas: Persona[]
}

export default function FeedView({ feed, persona, allPersonas }: Props) {
  const [lang, setLang] = useState<Lang>('ko')
  const [currentPersona, setCurrentPersona] = useState<Persona>(persona)
  const [videos, setVideos] = useState<Video[]>(feed?.videos ?? [])
  const [hasMore, setHasMore] = useState(feed?.has_more ?? false)
  const [nextOffset, setNextOffset] = useState(feed?.next_offset ?? 0)
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(feed?.total_accumulated ?? 0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [navigating, setNavigating] = useState(false)
  // hover 미리보기 — 현재 hover 중인 video_id (데스크톱)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 모바일 스크롤 자동재생 — 화면에 1초 이상 머문 카드
  const [mobilePlayingId, setMobilePlayingId] = useState<string | null>(null)
  // 포인터 지원 여부 감지 (hover: hover = 데스크톱, hover: none = 터치 기기)
  const [supportsHover, setSupportsHover] = useState(false)
  // 모바일 스크롤 자동재생용 타이머 ref
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 스크롤 중 여부 — setMobilePlayingId(null)을 첫 이벤트에서만 1회 호출하기 위한 가드
  const isScrollingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // 현재 활성 페르소나 ID를 ref로도 보관 — loadMore가 비동기 완료 시점에 페르소나가 바뀌었는지 확인용
  const activePersonaIdRef = useRef<string>(persona.id)
  // loadMore 동시 실행 방지 — state는 리렌더 전까지 반영 안 되므로 ref로 동기 가드
  const isLoadingRef = useRef(false)

  // 언어 설정 복원 (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('feed_lang') as Lang | null
    if (saved && ['ko', 'en', 'ja'].includes(saved)) setLang(saved)
  }, [])

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
      const videoId = findCardInZone()
      if (videoId) setMobilePlayingId(videoId)
    }

    function onScroll() {
      // 스크롤 첫 이벤트에서만 null 설정 — 매 이벤트마다 호출하면 초당 수십 번 리렌더 → 흰 깜박임
      if (!isScrollingRef.current) {
        isScrollingRef.current = true
        setMobilePlayingId(null)
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
    const initialTimer = setTimeout(playCardInZone, 600)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(initialTimer)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      setMobilePlayingId(null)
    }
  // videos[0]?.video_id: 페르소나 전환으로 피드가 교체될 때 effect 재실행 → initialTimer 재발동
  }, [supportsHover, videos[0]?.video_id])

  // 서버에서 직접 접근 시 (URL 직접 입력, 새로고침) prop 동기화
  // window.history.pushState 사용으로 Next.js navigation이 트리거되지 않아 이 effect는
  // 초기 마운트 시에만 발동됨 (브라우저 직접 접근 / 새로고침)
  useEffect(() => {
    setCurrentPersona(persona)
    setVideos(feed?.videos ?? [])
    setHasMore(feed?.has_more ?? false)
    setNextOffset(feed?.next_offset ?? 0)
    setTotal(feed?.total_accumulated ?? 0)
  }, [feed, persona.id])

  // 클라이언트사이드 페르소나 전환 (새로고침 없음)
  const switchPersona = useCallback(async (nextPersonaId: string) => {
    const nextPersona = allPersonas.find(p => p.id === nextPersonaId)
    if (!nextPersona || nextPersonaId === currentPersona.id) return

    gtag('persona_switch', { from: currentPersona.id, to: nextPersonaId, lang })

    // ref 즉시 갱신 — inflight loadMore가 응답 도착 시 stale 체크로 결과를 버리게 함
    activePersonaIdRef.current = nextPersonaId

    // 이전 페르소나 상태 즉시 초기화 — 이전 컨텐츠(다음 페이지 포함)가 화면에 남지 않도록
    setCurrentPersona(nextPersona)  // 페르소나 이름 즉시 반영
    setVideos([])
    setHasMore(false)
    setNextOffset(0)
    setNavigating(true)

    try {
      const res = await fetch(`/api/feed/${nextPersonaId}?offset=0&limit=20`)
      if (!res.ok) throw new Error('fetch failed')
      const data: FeedPageResponse = await res.json()

      // window.history.pushState: URL만 업데이트, Next.js navigation 트리거 안 함
      // → 서버 컴포넌트 재실행 없음 → ISR props 덮어쓰기 없음
      window.history.pushState(null, '', `/p/${nextPersonaId}`)

      setVideos(data.videos)
      setHasMore(data.has_more)
      setNextOffset(data.next_offset)
      setTotal(data.total_accumulated)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // fetch 실패 시 기존 방식으로 폴백
      window.location.href = `/p/${nextPersonaId}`
    } finally {
      setNavigating(false)
    }
  }, [currentPersona.id, allPersonas, lang])

  const loadMore = useCallback(async () => {
    // isLoadingRef: state가 리렌더 전까지 반영 안 되는 문제 → ref로 동기 가드
    // IntersectionObserver가 리렌더 전에 재발화해도 중복 실행 차단
    if (isLoadingRef.current || !hasMore) return
    isLoadingRef.current = true
    setIsLoading(true)
    // fetch 시작 시점의 페르소나 ID를 캡처 — 응답 도착 전에 페르소나가 바뀌면 결과 버림
    const personaAtStart = currentPersona.id
    try {
      const res = await fetch(`/api/feed/${personaAtStart}?offset=${nextOffset}&limit=20`)
      if (!res.ok) return
      const data: FeedPageResponse = await res.json()
      // 응답 도착 시점에 페르소나가 바뀌었으면 stale 결과이므로 무시
      if (personaAtStart !== activePersonaIdRef.current) return
      // video_id 기준 중복 제거 — 혹시라도 API가 겹치는 데이터를 반환하는 경우 방어
      setVideos(prev => {
        const existingIds = new Set(prev.map(v => v.video_id))
        const newVideos = data.videos.filter(v => !existingIds.has(v.video_id))
        return [...prev, ...newVideos]
      })
      setHasMore(data.has_more)
      setNextOffset(data.next_offset)
      setTotal(data.total_accumulated)
      gtag('infinite_scroll_load', { persona_id: currentPersona.id, offset: nextOffset, loaded: data.videos.length })
    } catch {
      // 에러 무시 (네트워크 오류 등)
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [hasMore, nextOffset, currentPersona.id])

  // 비디오 클릭 핸들러 — useCallback으로 메모이제이션해 VideoCard 불필요한 재렌더 방지
  const handleVideoClick = useCallback((video: Video, title: string, idx: number) => {
    gtag('video_click', {
      video_id: video.video_id,
      video_title: title,
      persona_id: currentPersona.id,
      position: idx + 1,
      lang,
    })
    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    if (isIOS) {
      const appUrl = `vnd.youtube://${video.video_id}`
      const webUrl = `https://www.youtube.com/watch?v=${video.video_id}`
      const start = Date.now()
      window.location.href = appUrl
      setTimeout(() => {
        if (Date.now() - start < 1500) window.open(webUrl, '_blank')
      }, 300)
    } else if (isAndroid) {
      window.location.href = `intent://www.youtube.com/watch?v=${video.video_id}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https://www.youtube.com/watch?v=${video.video_id};end`
    } else {
      window.open(video.url, '_blank')
    }
  }, [currentPersona.id, lang])

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
    gtag('language_switch', { from: lang, to: l, persona_id: currentPersona.id })
    setLang(l)
    localStorage.setItem('feed_lang', l)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      {/* 페이지 전환 Progress Bar */}
      <NavigationProgress active={navigating} />

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
            value={currentPersona.id}
            onChange={e => switchPersona(e.target.value)}
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
      {(feed || videos.length > 0) && (
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

      {/* 피드 없음 */}
      {!feed && videos.length === 0 && (
        <div className="flex items-center justify-center py-32 text-zinc-500 text-sm">
          {t('noFeed', lang)}
        </div>
      )}

      {/* 피드 그리드 */}
      {(feed || videos.length > 0) && (
        <main className="px-6 py-6 max-w-7xl mx-auto">
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
                isPlaying={mobilePlayingId === video.video_id}
                isHovered={hoveredId === video.video_id}
                personaId={currentPersona.id}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onVideoClick={handleVideoClick}
              />
            ))}
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
          gtag('feedback_click', { persona_id: currentPersona.id, lang })
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
          personaId={currentPersona.id}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </>
  )
}
