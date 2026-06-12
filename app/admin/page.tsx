'use client'

import { useEffect, useState, useRef } from 'react'
import { Persona } from '@/types'

type VideoStats = Record<string, { total: number; with_summary: number; stt_skip: number; no_summary: number; latest_date: string | null }>
type AccessLogs = {
  total_7d: number
  total_all: number
  unique_ips: number
  external_unique_ips: number
  my_ip_hash: string
  by_persona: Record<string, number>
  all_time_by_persona: Record<string, number>
  by_country: Record<string, number>
  daily: Record<string, number>
}

type StatPeriod = '7d' | '30d' | '90d'
type UserBehavior = {
  sessions_7d: number
  video_clicks_7d: number
  scroll_loads_7d: number
  avg_clicks_per_session: number
  scroll_depth: { page1_only: number; page2_4: number; page5_plus: number }
  top_videos: { video_id: string; clicks: number }[]
}
type LikeStats = { total: number; by_persona: Record<string, number> }
type StatsResponse = { videos: VideoStats; access_logs: AccessLogs; user_behavior?: UserBehavior; likes?: LikeStats }

type VideoRow = {
  video_id: string
  title: string
  titles_i18n?: Record<string, string>
  channel: string
  url: string
  score: number
  collected_date: string
  feed_source: string
}

type ShortRow = {
  video_id: string
  title: string
  titles_i18n?: Record<string, string>
  channel: string
  url: string
  score: number
  collected_date: string
}

type FeedbackRow = {
  id: string
  persona_id: string | null
  rating: number | null
  comment: string | null
  content_suggestion: string | null
  lang: string | null
  created_at: string
}

type View = 'login' | 'dashboard'

// ── 섹션 탭 타입
type SectionTab = 'overview' | 'content' | 'users' | 'feedback'

// ── 미니 컴포넌트: 섹션 제목
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 mb-3">
      {children}
    </p>
  )
}

// ── 미니 컴포넌트: KPI 카드
function KpiCard({
  label,
  value,
  sub,
  accent = false,
  warn = false,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-1.5">
      <p className="text-[11px] text-zinc-500 font-medium">{label}</p>
      <p
        className={`text-3xl font-mono font-bold leading-none tabular-nums ${
          accent ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-zinc-100'
        }`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-[11px] text-zinc-600">{sub}</p>}
    </div>
  )
}

// ── 미니 컴포넌트: 구분선
function Divider() {
  return <div className="border-t border-zinc-800/80" />
}

export default function AdminPage() {
  const [view, setView] = useState<View>('login')
  const [token, setToken] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [videoStats, setVideoStats] = useState<VideoStats>({})
  const [accessLogs, setAccessLogs] = useState<AccessLogs | null>(null)
  const [userBehavior, setUserBehavior] = useState<UserBehavior | null>(null)
  const [likeStats, setLikeStats] = useState<LikeStats | null>(null)
  const [statPeriod, setStatPeriod] = useState<StatPeriod>('7d')
  const [statsLoading, setStatsLoading] = useState(false)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState('')
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedMsg, setFeedMsg] = useState('')
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [triggerStatus, setTriggerStatus] = useState<Record<string, string>>({})
  const [feedChecked, setFeedChecked] = useState<Set<string>>(new Set())
  const [shortsPersona, setShortsPersona] = useState('')
  const [shorts, setShorts] = useState<ShortRow[]>([])
  const [shortsLoading, setShortsLoading] = useState(false)
  const [shortsMsg, setShortsMsg] = useState('')
  const [shortsChecked, setShortsChecked] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<SectionTab>('overview')

  type AdminPersonaEntry = { persona_id: string; name: string; video_count: number; is_public: boolean; days_since_update: number; is_inactive: boolean }
  type AdminUserEntry = { id: string; email: string; nickname: string | null; is_banned: boolean; created_at: string; last_sign_in_at: string | null; personas: AdminPersonaEntry[] }
  const [adminUsers, setAdminUsers] = useState<AdminUserEntry[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [personaAction, setPersonaAction] = useState<Record<string, string>>({})
  const [banAction, setBanAction] = useState<Record<string, string>>({})

  async function loadAdminUsers() {
    setAdminUsersLoading(true)
    const res = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' })
    if (res.ok) {
      const d = await res.json()
      setAdminUsers(d.users ?? [])
    }
    setAdminUsersLoading(false)
  }

  function toggleUserExpand(userId: string) {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function handleBanUser(userId: string, action: 'ban' | 'unban') {
    setBanAction(prev => ({ ...prev, [userId]: '처리 중...' }))
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: action === 'ban' } : u))
    }
    setBanAction(prev => { const n = { ...prev }; delete n[userId]; return n })
  }

  async function handlePersonaAction(personaId: string, userId: string, action: 'notify' | 'delete') {
    setPersonaAction(prev => ({ ...prev, [personaId]: action === 'notify' ? '발송 중...' : '삭제 중...' }))
    const res = await fetch('/api/admin/user-personas', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, persona_id: personaId }),
    })
    const d = await res.json()
    if (action === 'notify') {
      setPersonaAction(prev => ({ ...prev, [personaId]: res.ok ? `✓ ${d.sent_to}` : `✗ ${d.error}` }))
      setTimeout(() => setPersonaAction(prev => { const n = { ...prev }; delete n[personaId]; return n }), 3000)
    } else {
      if (res.ok) {
        setAdminUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, personas: u.personas.filter(p => p.persona_id !== personaId) } : u
        ))
      } else {
        setPersonaAction(prev => ({ ...prev, [personaId]: `✗ ${d.error}` }))
      }
    }
  }

  useEffect(() => {
    Promise.all([fetchStats(), loadPersonas(), loadFeedbacks()]).then(([data]) => {
      if (data) {
        setVideoStats(data.videos)
        setAccessLogs(data.access_logs)
        if (data.user_behavior) setUserBehavior(data.user_behavior)
        if (data.likes) setLikeStats(data.likes)
        setView('dashboard')
      }
    })
  }, [])

  async function fetchStats(period: StatPeriod = '7d'): Promise<StatsResponse | null> {
    const res = await fetch(`/api/admin/stats?period=${period}`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  }

  async function changePeriod(p: StatPeriod) {
    setStatPeriod(p)
    setStatsLoading(true)
    const data = await fetchStats(p)
    if (data) {
      setAccessLogs(data.access_logs)
      if (data.user_behavior) setUserBehavior(data.user_behavior)
      if (data.likes) setLikeStats(data.likes)
    }
    setStatsLoading(false)
  }

  async function loadPersonas(): Promise<void> {
    const res = await fetch('/api/personas')
    const data = await res.json()
    setPersonas(data.personas ?? [])
  }

  async function loadFeedbacks(): Promise<void> {
    const res = await fetch('/api/admin/feedbacks', { credentials: 'include' })
    if (!res.ok) return
    const data = await res.json()
    setFeedbacks(data.feedbacks ?? [])
  }

  async function triggerCollect(personaId: string) {
    setTriggerStatus(prev => ({ ...prev, [personaId]: 'requesting' }))
    const res = await fetch(`/api/admin/trigger/${personaId}`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    const msg = data.status === 'queued' ? '✓ 큐 추가' :
                data.status === 'already_queued' ? '⏳ 대기 중' : '✗ 실패'
    setTriggerStatus(prev => ({ ...prev, [personaId]: msg }))
    setTimeout(() => setTriggerStatus(prev => ({ ...prev, [personaId]: '' })), 3000)
  }

  async function handleLogin() {
    setLoginError(null)
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    })
    if (res.ok) {
      const [data] = await Promise.all([fetchStats(), loadPersonas(), loadFeedbacks()])
      if (data) {
        setVideoStats(data.videos)
        setAccessLogs(data.access_logs)
        if (data.user_behavior) setUserBehavior(data.user_behavior)
        setView('dashboard')
      }
    } else {
      setLoginError('토큰이 올바르지 않습니다.')
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    setView('login')
    setToken('')
    setVideoStats({})
    setAccessLogs(null)
    setUserBehavior(null)
    setVideos([])
  }

  async function loadFeed(personaId: string) {
    if (!personaId) return
    setFeedLoading(true)
    setFeedMsg('불러오는 중...')
    setVideos([])
    const res = await fetch(`/api/admin/feed/${personaId}`, { credentials: 'include' })
    if (!res.ok) { setFeedMsg('로드 실패'); setFeedLoading(false); return }
    const data = await res.json()
    setVideos(data.videos ?? [])
    setFeedMsg(`${data.videos?.length ?? 0}개`)
    setFeedChecked(new Set())
    setFeedLoading(false)
  }

  async function loadShorts(personaId: string) {
    if (!personaId) return
    setShortsLoading(true)
    setShortsMsg('불러오는 중...')
    setShorts([])
    setShortsChecked(new Set())
    const res = await fetch(`/api/admin/shorts/${personaId}`, { credentials: 'include' })
    if (!res.ok) { setShortsMsg('로드 실패'); setShortsLoading(false); return }
    const data = await res.json()
    setShorts(data.shorts ?? [])
    setShortsMsg(`${data.shorts?.length ?? 0}개`)
    setShortsLoading(false)
  }

  async function deleteShort(personaId: string, videoId: string) {
    if (!confirm('이 Shorts를 삭제할까요?')) return
    const res = await fetch(`/api/admin/shorts/${personaId}/${videoId}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setShorts(prev => prev.filter(s => s.video_id !== videoId))
      setShortsChecked(prev => { const n = new Set(prev); n.delete(videoId); return n })
      setShortsMsg(prev => { const n = parseInt(prev) - 1; return isNaN(n) ? prev : `${n}개` })
    } else { alert('삭제 실패') }
  }

  async function deleteCheckedShorts() {
    if (shortsChecked.size === 0) return
    if (!confirm(`선택한 ${shortsChecked.size}개의 Shorts를 삭제할까요?`)) return
    const ids = [...shortsChecked]
    await Promise.all(ids.map(id => fetch(`/api/admin/shorts/${shortsPersona}/${id}`, { method: 'DELETE', credentials: 'include' })))
    setShorts(prev => prev.filter(s => !shortsChecked.has(s.video_id)))
    setShortsMsg(prev => { const n = parseInt(prev) - ids.length; return isNaN(n) ? prev : `${n}개` })
    setShortsChecked(new Set())
  }

  function toggleShortsCheck(videoId: string) {
    setShortsChecked(prev => { const n = new Set(prev); n.has(videoId) ? n.delete(videoId) : n.add(videoId); return n })
  }
  function toggleAllShorts() {
    if (shortsChecked.size === shorts.length) setShortsChecked(new Set())
    else setShortsChecked(new Set(shorts.map(s => s.video_id)))
  }

  async function deleteVideo(personaId: string, videoId: string) {
    if (!confirm('이 영상을 삭제할까요?')) return
    const res = await fetch(`/api/admin/feed/${personaId}/${videoId}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setVideos(prev => prev.filter(v => v.video_id !== videoId))
      setFeedChecked(prev => { const n = new Set(prev); n.delete(videoId); return n })
      setFeedMsg(prev => { const n = parseInt(prev) - 1; return isNaN(n) ? prev : `${n}개` })
    } else { alert('삭제 실패') }
  }

  async function deleteCheckedVideos() {
    if (feedChecked.size === 0) return
    if (!confirm(`선택한 ${feedChecked.size}개의 영상을 삭제할까요?`)) return
    const ids = [...feedChecked]
    await Promise.all(ids.map(id => fetch(`/api/admin/feed/${selectedPersona}/${id}`, { method: 'DELETE', credentials: 'include' })))
    setVideos(prev => prev.filter(v => !feedChecked.has(v.video_id)))
    setFeedMsg(prev => { const n = parseInt(prev) - ids.length; return isNaN(n) ? prev : `${n}개` })
    setFeedChecked(new Set())
  }

  function toggleFeedCheck(videoId: string) {
    setFeedChecked(prev => { const n = new Set(prev); n.has(videoId) ? n.delete(videoId) : n.add(videoId); return n })
  }
  function toggleAllFeed() {
    if (feedChecked.size === videos.length) setFeedChecked(new Set())
    else setFeedChecked(new Set(videos.map(v => v.video_id)))
  }

  // ── 로그인 화면
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-full max-w-sm px-4">
          {/* 로고 영역 */}
          <div className="mb-8 text-center">
            <p className="text-[10px] font-mono tracking-[0.2em] text-zinc-600 uppercase mb-2">Anomess</p>
            <h1 className="text-2xl font-semibold text-zinc-100">관리자 콘솔</h1>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            {loginError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2.5">
                <span className="shrink-0">✕</span>
                {loginError}
              </div>
            )}
            <input
              type="password"
              placeholder="Admin Token"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              로그인
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── 헬퍼
  function personaName(pid: string): string {
    return personas.find(p => p.id === pid)?.name ?? pid
  }

  const PERIOD_LABEL: Record<StatPeriod, string> = { '7d': '7일', '30d': '30일', '90d': '90일' }

  // 일별 그래프 — 최근 14개로 제한, 높이 고정
  const dailyEntries = Object.entries(accessLogs?.daily ?? {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1)

  // 피드백 통계
  const ratedFeedbacks = feedbacks.filter(f => f.rating)
  const avgRating = ratedFeedbacks.length > 0
    ? (ratedFeedbacks.reduce((s, f) => s + (f.rating ?? 0), 0) / ratedFeedbacks.length).toFixed(1)
    : null

  // 탭 목록
  const TABS: { id: SectionTab; label: string; count?: number }[] = [
    { id: 'overview', label: '개요' },
    { id: 'content', label: '콘텐츠', count: Object.values(videoStats).reduce((s, v) => s + v.total, 0) },
    { id: 'users', label: '유저', count: adminUsers.length || undefined },
    { id: 'feedback', label: '피드백', count: feedbacks.length || undefined },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">

      {/* ── 상단 헤더 ── */}
      <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* 좌: 브랜드 + 탭 */}
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-500 uppercase shrink-0">Anomess Admin</span>
            <nav className="flex items-center gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    if (tab.id === 'users' && adminUsers.length === 0) loadAdminUsers()
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                      activeTab === tab.id ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-900 text-zinc-600'
                    }`}>
                      {tab.count.toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* 우: 기간 필터 + 로그아웃 */}
          <div className="flex items-center gap-3">
            {/* 기간 필터 — 개요 탭일 때만 강조 */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as StatPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => changePeriod(p)}
                  disabled={statsLoading}
                  className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                    statPeriod === p
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  } disabled:opacity-40`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
            <a href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              ← 피드
            </a>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-500 border border-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-900 hover:text-zinc-300 transition-all"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* ── 로딩 바 ── */}
      {statsLoading && (
        <div className="h-0.5 w-full overflow-hidden bg-zinc-900">
          <div className="h-full bg-emerald-500/60 animate-pulse w-full" />
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ══════════════════════════════════════════
            탭: 개요
        ══════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className={`space-y-8 transition-opacity duration-200 ${statsLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

            {/* KPI 상단 4개 */}
            <div>
              <SectionLabel>핵심 지표 — 최근 {PERIOD_LABEL[statPeriod]}</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="외부 방문자 (나 제외)"
                  value={accessLogs?.external_unique_ips ?? 0}
                  sub={`전체 unique IP ${accessLogs?.unique_ips ?? 0}명`}
                  accent
                />
                <KpiCard
                  label="API 요청"
                  value={accessLogs?.total_7d ?? 0}
                  sub={`누적 전체 ${(accessLogs?.total_all ?? 0).toLocaleString()}`}
                />
                {userBehavior && (
                  <>
                    <KpiCard
                      label="고유 세션"
                      value={userBehavior.sessions_7d}
                      sub={`영상 클릭 ${userBehavior.video_clicks_7d}회`}
                    />
                    <KpiCard
                      label="세션당 평균 클릭"
                      value={userBehavior.avg_clicks_per_session}
                      sub="영상 클릭 / 세션"
                      accent={userBehavior.avg_clicks_per_session >= 2}
                    />
                  </>
                )}
                {!userBehavior && (
                  <>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 col-span-2 flex items-center justify-center">
                      <p className="text-xs text-zinc-600">행동 데이터 없음</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Divider />

            {/* 일별 트래픽 + 페르소나/국가별 */}
            <div>
              <SectionLabel>트래픽 분석 — {PERIOD_LABEL[statPeriod]}</SectionLabel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

                {/* 일별 바 차트 */}
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-xs text-zinc-500 mb-4">일별 API 요청</p>
                  {dailyEntries.length === 0 ? (
                    <p className="text-xs text-zinc-700 py-4 text-center">데이터 없음</p>
                  ) : (
                    <div className="flex items-end gap-1" style={{ height: '80px' }}>
                      {dailyEntries.map(([day, cnt]) => {
                        const pct = maxDaily > 0 ? cnt / maxDaily : 0
                        const barH = Math.max(Math.round(pct * 72), 2)
                        return (
                          <div key={day} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                            <div
                              className="w-full bg-zinc-600 hover:bg-emerald-500/60 rounded-sm transition-colors cursor-default"
                              style={{ height: `${barH}px` }}
                              title={`${day}: ${cnt.toLocaleString()}건`}
                            />
                            <span className="text-[9px] font-mono text-zinc-700 shrink-0">{day.slice(5)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 국가별 */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-xs text-zinc-500 mb-3">국가별 top 10</p>
                  <div className="space-y-2">
                    {Object.entries(accessLogs?.by_country ?? {}).slice(0, 10).map(([country, cnt]) => {
                      const total = accessLogs?.total_7d ?? 1
                      const pct = Math.round((cnt / total) * 100)
                      return (
                        <div key={country} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">{country || '(unknown)'}</span>
                            <span className="font-mono text-zinc-300">{cnt}</span>
                          </div>
                          <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-zinc-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(accessLogs?.by_country ?? {}).length === 0 && (
                      <p className="text-xs text-zinc-700">데이터 없음</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Divider />

            {/* 페르소나별 요청 + 스크롤 깊이 + 인기 영상 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

              {/* 페르소나별 요청 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 mb-3">페르소나별 요청</p>
                <div className="space-y-2.5">
                  {Object.entries(accessLogs?.by_persona ?? {}).map(([pid, cnt]) => (
                    <div key={pid} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-400 truncate flex-1">{personaName(pid)}</span>
                      <span className="text-xs font-mono text-zinc-300 shrink-0">{cnt.toLocaleString()}</span>
                    </div>
                  ))}
                  {Object.keys(accessLogs?.by_persona ?? {}).length === 0 && (
                    <p className="text-xs text-zinc-700">데이터 없음</p>
                  )}
                </div>
              </div>

              {/* 스크롤 깊이 */}
              {userBehavior && (() => {
                const d = userBehavior.scroll_depth
                const total = d.page1_only + d.page2_4 + d.page5_plus
                const bars = [
                  { label: '1배치만', val: d.page1_only, color: 'bg-zinc-600' },
                  { label: '2–4배치', val: d.page2_4, color: 'bg-zinc-500' },
                  { label: '5배치+', val: d.page5_plus, color: 'bg-emerald-500' },
                ]
                return (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                    <p className="text-xs text-zinc-500 mb-3">스크롤 깊이</p>
                    {total === 0 ? (
                      <p className="text-xs text-zinc-700">데이터 없음</p>
                    ) : (
                      <div className="space-y-3">
                        {bars.map(b => (
                          <div key={b.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">{b.label}</span>
                              <span className="font-mono text-zinc-300">{Math.round(b.val / total * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${b.color} rounded-full transition-all`}
                                style={{ width: `${Math.round(b.val / total * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                        <p className="text-[11px] text-zinc-600 pt-1">총 {total} 세션 기준</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* 인기 영상 */}
              {userBehavior && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <p className="text-xs text-zinc-500 mb-3">인기 영상 TOP 5</p>
                  {userBehavior.top_videos.length === 0 ? (
                    <p className="text-xs text-zinc-700">데이터 없음</p>
                  ) : (
                    <div className="space-y-2">
                      {userBehavior.top_videos.map((v, i) => (
                        <div key={v.video_id} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-zinc-600 w-4 shrink-0">{i + 1}</span>
                          <a
                            href={`https://www.youtube.com/watch?v=${v.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-400 hover:text-zinc-200 font-mono truncate flex-1 transition-colors"
                          >
                            {v.video_id}
                          </a>
                          <span className="text-xs font-mono text-zinc-300 shrink-0">{v.clicks}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Divider />

            {/* 페르소나별 누적 현황 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>페르소나별 누적 현황</SectionLabel>
                {likeStats && likeStats.total > 0 && (
                  <span className="text-[11px] font-mono text-rose-400">♥ {likeStats.total.toLocaleString()}</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(videoStats).length === 0 ? (
                  <p className="text-xs text-zinc-600">데이터 없음</p>
                ) : (
                  Object.entries(videoStats).map(([pid, info]) => {
                    const summaryPct = info.total > 0 ? Math.round((info.with_summary ?? 0) / info.total * 100) : 0
                    return (
                      <div key={pid} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-zinc-400 font-medium">{personaName(pid)}</p>
                          <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                            {(accessLogs?.all_time_by_persona[pid] ?? 0) > 0 && (
                              <span className="text-sky-400">👁 {(accessLogs!.all_time_by_persona[pid]).toLocaleString()}</span>
                            )}
                            {(likeStats?.by_persona[pid] ?? 0) > 0 && (
                              <span className="text-rose-400">♥{likeStats!.by_persona[pid]}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-end gap-1.5">
                          <p className="text-3xl font-mono font-bold text-zinc-100 leading-none">{info.total}</p>
                          <p className="text-xs text-zinc-600 mb-0.5">개</p>
                        </div>
                        {/* AI요약 진행바 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500">AI요약</span>
                            <span className="font-mono text-emerald-500">{summaryPct}%</span>
                          </div>
                          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500/70 rounded-full"
                              style={{ width: `${summaryPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(info.stt_skip ?? 0) > 0 && (
                            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                              skip {info.stt_skip}
                            </span>
                          )}
                          {(info.no_summary ?? 0) > 0 && (
                            <span className="text-[10px] font-mono bg-amber-950/40 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/40">
                              미완료 {info.no_summary}
                            </span>
                          )}
                          {info.latest_date && (
                            <span className="text-[10px] font-mono text-zinc-700 ml-auto">{info.latest_date}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <Divider />

            {/* 수동 수집 트리거 */}
            <div>
              <SectionLabel>수동 수집 트리거</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {personas.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <button
                      onClick={() => triggerCollect(p.id)}
                      disabled={triggerStatus[p.id] === 'requesting'}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs font-medium px-3.5 py-2 rounded-lg transition-all disabled:opacity-40 flex items-center gap-2"
                    >
                      <span className="text-zinc-500">▶</span>
                      {p.name}
                    </button>
                    {triggerStatus[p.id] && (
                      <span className="text-[11px] font-mono text-zinc-500">{triggerStatus[p.id]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            탭: 콘텐츠 (피드 + Shorts 관리)
        ══════════════════════════════════════════ */}
        {activeTab === 'content' && (
          <div className="space-y-10">

            {/* 피드 관리 */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <SectionLabel>피드 관리</SectionLabel>
                <select
                  value={selectedPersona}
                  onChange={e => { setSelectedPersona(e.target.value); loadFeed(e.target.value) }}
                  className="ml-auto bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300"
                >
                  <option value="">페르소나 선택...</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {feedChecked.size > 0 && (
                  <button
                    onClick={deleteCheckedVideos}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-900/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    선택 삭제 ({feedChecked.size})
                  </button>
                )}
              </div>

              {feedMsg && !feedLoading && (
                <p className="text-[11px] font-mono text-zinc-600 mb-3">{feedMsg}</p>
              )}
              {feedLoading && (
                <div className="flex items-center gap-2 text-xs text-zinc-600 py-8">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                  불러오는 중...
                </div>
              )}
              {!feedLoading && videos.length > 0 && (
                <VideoTable
                  videos={videos}
                  checked={feedChecked}
                  onToggle={toggleFeedCheck}
                  onToggleAll={toggleAllFeed}
                  onDelete={id => deleteVideo(selectedPersona, id)}
                />
              )}
            </div>

            <Divider />

            {/* Shorts 관리 */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <SectionLabel>Shorts 관리</SectionLabel>
                <select
                  value={shortsPersona}
                  onChange={e => { setShortsPersona(e.target.value); loadShorts(e.target.value) }}
                  className="ml-auto bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-600 transition-colors text-zinc-300"
                >
                  <option value="">페르소나 선택...</option>
                  {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {shortsChecked.size > 0 && (
                  <button
                    onClick={deleteCheckedShorts}
                    className="text-xs text-red-400 hover:text-red-300 border border-red-900/60 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    선택 삭제 ({shortsChecked.size})
                  </button>
                )}
              </div>
              {shortsMsg && !shortsLoading && (
                <p className="text-[11px] font-mono text-zinc-600 mb-3">{shortsMsg}</p>
              )}
              {shortsLoading && (
                <div className="flex items-center gap-2 text-xs text-zinc-600 py-8">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                  불러오는 중...
                </div>
              )}
              {!shortsLoading && shorts.length > 0 && (
                <ShortsTable
                  shorts={shorts}
                  checked={shortsChecked}
                  onToggle={toggleShortsCheck}
                  onToggleAll={toggleAllShorts}
                  onDelete={id => deleteShort(shortsPersona, id)}
                />
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            탭: 유저
        ══════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <SectionLabel>가입 유저</SectionLabel>
              <div className="flex items-center gap-3">
                {adminUsers.length > 0 && (
                  <p className="text-[11px] font-mono text-zinc-600">
                    {adminUsers.length}명 · 밴 {adminUsers.filter(u => u.is_banned).length} · 페르소나 {adminUsers.reduce((s, u) => s + u.personas.length, 0)}개
                  </p>
                )}
                <button
                  onClick={loadAdminUsers}
                  disabled={adminUsersLoading}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 transition-all disabled:opacity-40"
                >
                  {adminUsersLoading ? '로딩 중...' : '새로고침'}
                </button>
              </div>
            </div>

            {adminUsers.length === 0 && !adminUsersLoading && (
              <p className="text-xs text-zinc-700 py-8 text-center">유저 목록을 불러오려면 새로고침을 클릭하세요.</p>
            )}
            {adminUsersLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 py-12">
                <div className="w-3.5 h-3.5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                불러오는 중...
              </div>
            )}

            <div className="space-y-2">
              {adminUsers.map(u => {
                const isExpanded = expandedUsers.has(u.id)
                const inactiveCount = u.personas.filter(p => p.is_inactive).length
                return (
                  <div
                    key={u.id}
                    className={`rounded-xl border overflow-hidden transition-colors ${
                      u.is_banned
                        ? 'border-red-900/50 bg-red-950/10'
                        : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => toggleUserExpand(u.id)}
                        className="text-zinc-600 hover:text-zinc-300 shrink-0 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d={isExpanded ? 'M2 4l4 4 4-4' : 'M4 2l4 4-4 4'}
                            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-zinc-200 truncate">{u.email}</span>
                          {u.nickname && <span className="text-xs text-zinc-500">@{u.nickname}</span>}
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
                            u.is_banned
                              ? 'bg-red-950/60 text-red-300 border-red-800/50'
                              : 'bg-emerald-950/40 text-emerald-500 border-emerald-900/40'
                          }`}>
                            {u.is_banned ? 'banned' : 'active'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-zinc-600">
                          <span>가입 {u.created_at.slice(0, 10)}</span>
                          {u.last_sign_in_at && <span>최근 {u.last_sign_in_at.slice(0, 10)}</span>}
                          <span>페르소나 {u.personas.length}
                            {inactiveCount > 0 && <span className="text-amber-600 ml-1">(비활성 {inactiveCount})</span>}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(u.is_banned ? `${u.email} 밴 해제?` : `${u.email} 밴?`)) {
                            handleBanUser(u.id, u.is_banned ? 'unban' : 'ban')
                          }
                        }}
                        disabled={!!banAction[u.id]}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all shrink-0 disabled:opacity-40 ${
                          u.is_banned
                            ? 'border-zinc-700 text-zinc-400 hover:border-emerald-700 hover:text-emerald-400'
                            : 'border-red-900/60 text-red-400 hover:border-red-700 hover:text-red-300'
                        }`}
                      >
                        {banAction[u.id] ? banAction[u.id] : u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-zinc-800/60 px-4 pb-3 pt-2">
                        {u.personas.length === 0 ? (
                          <p className="text-xs text-zinc-700 py-1">페르소나 없음</p>
                        ) : (
                          <div className="space-y-1.5">
                            {u.personas.map(p => (
                              <div
                                key={p.persona_id}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                                  p.is_inactive ? 'bg-amber-950/20' : 'bg-zinc-800/30'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <a
                                      href={`/p/${p.persona_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-zinc-300 hover:text-white truncate transition-colors"
                                    >
                                      {p.name}
                                    </a>
                                    {p.is_inactive && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">비활성</span>
                                    )}
                                    {!p.is_public && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">비공개</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-600 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>영상 {p.video_count} · {p.days_since_update}일 전</span>
                                    {(accessLogs?.all_time_by_persona[p.persona_id] ?? 0) > 0 && (
                                      <span className="text-sky-500">
                                        👁 {(accessLogs!.all_time_by_persona[p.persona_id]).toLocaleString()}
                                      </span>
                                    )}
                                    {(likeStats?.by_persona[p.persona_id] ?? 0) > 0 && (
                                      <span className="text-rose-500">♥ {likeStats!.by_persona[p.persona_id]}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {personaAction[p.persona_id] ? (
                                    <span className="text-[11px] font-mono text-zinc-500">{personaAction[p.persona_id]}</span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handlePersonaAction(p.persona_id, u.id, 'notify')}
                                        className="text-[11px] px-2 py-0.5 rounded border border-zinc-700 hover:border-indigo-600 hover:text-indigo-400 text-zinc-400 transition-all"
                                      >
                                        이메일
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm(`"${p.name}" 삭제?`)) handlePersonaAction(p.persona_id, u.id, 'delete')
                                        }}
                                        className="text-[11px] px-2 py-0.5 rounded border border-red-900/60 text-red-400 hover:text-red-300 hover:border-red-700 transition-all"
                                      >
                                        삭제
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            탭: 피드백
        ══════════════════════════════════════════ */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <SectionLabel>피드백</SectionLabel>
              <span className="text-[11px] font-mono text-zinc-600">{feedbacks.length}건</span>
            </div>

            {/* 별점 요약 */}
            {feedbacks.length > 0 && avgRating && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-3xl font-mono font-bold text-amber-400 leading-none">{avgRating}</p>
                    <p className="text-[11px] text-zinc-600 mt-1">평균 별점</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {[5, 4, 3, 2, 1].map(n => {
                      const cnt = feedbacks.filter(f => f.rating === n).length
                      return (
                        <div key={n} className="text-center">
                          <p className="text-xs font-mono text-zinc-300">{cnt}</p>
                          <p className="text-[10px] text-amber-500/60">{'★'.repeat(n)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {feedbacks.length === 0 ? (
              <p className="text-xs text-zinc-700 py-8 text-center">피드백 없음</p>
            ) : (
              <div className="space-y-2">
                {feedbacks.map(fb => (
                  <div key={fb.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-start gap-4">
                    <div className="shrink-0 font-mono text-amber-400 text-sm w-12 pt-0.5">
                      {fb.rating ? '★'.repeat(fb.rating) : '—'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {fb.content_suggestion && (
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/50 text-blue-400 border border-blue-900/40 shrink-0 mt-0.5">제안</span>
                          <p className="text-sm text-blue-200 break-words">{fb.content_suggestion}</p>
                        </div>
                      )}
                      <p className="text-sm text-zinc-300 break-words">
                        {fb.comment || <span className="text-zinc-700 italic text-xs">코멘트 없음</span>}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                        <span>{personaName(fb.persona_id ?? '')}</span>
                        {fb.lang && <><span>·</span><span>{fb.lang.toUpperCase()}</span></>}
                        <span>·</span>
                        <span>{fb.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}

// ── 서브 컴포넌트: 영상 테이블
function VideoTable({
  videos,
  checked,
  onToggle,
  onToggleAll,
  onDelete,
}: {
  videos: { video_id: string; title: string; titles_i18n?: Record<string, string>; channel: string; url: string; score: number; collected_date: string }[]
  checked: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            <th className="py-2.5 px-3 w-8">
              <input
                type="checkbox"
                checked={checked.size === videos.length && videos.length > 0}
                onChange={onToggleAll}
                className="accent-zinc-400"
              />
            </th>
            <th className="py-2.5 px-3 text-left font-medium text-zinc-500">제목</th>
            <th className="py-2.5 px-3 text-left font-medium text-zinc-500 w-28">채널</th>
            <th className="py-2.5 px-3 text-right font-mono text-zinc-500 w-12">점수</th>
            <th className="py-2.5 px-3 font-mono text-zinc-500 w-24">날짜</th>
            <th className="py-2.5 px-3 w-14" />
          </tr>
        </thead>
        <tbody>
          {videos.map(v => (
            <tr key={v.video_id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={checked.has(v.video_id)}
                  onChange={() => onToggle(v.video_id)}
                  className="accent-zinc-400"
                />
              </td>
              <td className="py-2 px-3">
                <a href={v.url} target="_blank" rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-white line-clamp-1 transition-colors">
                  {v.titles_i18n?.ko || v.title}
                </a>
              </td>
              <td className="py-2 px-3 text-zinc-600 truncate max-w-[7rem]">{v.channel}</td>
              <td className="py-2 px-3 text-right font-mono text-zinc-400">{v.score}</td>
              <td className="py-2 px-3 font-mono text-zinc-600">{v.collected_date}</td>
              <td className="py-2 px-3">
                <button
                  onClick={() => onDelete(v.video_id)}
                  className="text-red-500/70 hover:text-red-400 border border-red-900/40 hover:border-red-800 px-2 py-0.5 rounded transition-all"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 서브 컴포넌트: Shorts 테이블
function ShortsTable({
  shorts,
  checked,
  onToggle,
  onToggleAll,
  onDelete,
}: {
  shorts: { video_id: string; title: string; titles_i18n?: Record<string, string>; channel: string; url: string; score: number; collected_date: string }[]
  checked: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            <th className="py-2.5 px-3 w-8">
              <input
                type="checkbox"
                checked={checked.size === shorts.length && shorts.length > 0}
                onChange={onToggleAll}
                className="accent-zinc-400"
              />
            </th>
            <th className="py-2.5 px-3 text-left font-medium text-zinc-500">제목</th>
            <th className="py-2.5 px-3 text-left font-medium text-zinc-500 w-28">채널</th>
            <th className="py-2.5 px-3 text-right font-mono text-zinc-500 w-12">점수</th>
            <th className="py-2.5 px-3 font-mono text-zinc-500 w-24">날짜</th>
            <th className="py-2.5 px-3 w-14" />
          </tr>
        </thead>
        <tbody>
          {shorts.map(s => (
            <tr key={s.video_id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
              <td className="py-2 px-3">
                <input
                  type="checkbox"
                  checked={checked.has(s.video_id)}
                  onChange={() => onToggle(s.video_id)}
                  className="accent-zinc-400"
                />
              </td>
              <td className="py-2 px-3">
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="text-zinc-300 hover:text-white line-clamp-1 transition-colors">
                  {s.titles_i18n?.ko || s.title}
                </a>
              </td>
              <td className="py-2 px-3 text-zinc-600 truncate max-w-[7rem]">{s.channel}</td>
              <td className="py-2 px-3 text-right font-mono text-zinc-400">{s.score}</td>
              <td className="py-2 px-3 font-mono text-zinc-600">{s.collected_date}</td>
              <td className="py-2 px-3">
                <button
                  onClick={() => onDelete(s.video_id)}
                  className="text-red-500/70 hover:text-red-400 border border-red-900/40 hover:border-red-800 px-2 py-0.5 rounded transition-all"
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
