'use client'

import { useEffect, useState } from 'react'
import { Persona } from '@/types'

type VideoStats = Record<string, { total: number; with_summary: number; stt_skip: number; no_summary: number; latest_date: string | null }>
type AccessLogs = {
  total_7d: number
  unique_ips: number
  external_unique_ips: number
  my_ip_hash: string
  by_persona: Record<string, number>
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

export default function AdminPage() {
  const [view, setView] = useState<View>('login')
  const [token, setToken] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [videoStats, setVideoStats] = useState<VideoStats>({})
  const [accessLogs, setAccessLogs] = useState<AccessLogs | null>(null)
  const [userBehavior, setUserBehavior] = useState<UserBehavior | null>(null)
  const [likeStats, setLikeStats] = useState<LikeStats | null>(null)
  const [statPeriod, setStatPeriod] = useState<StatPeriod>('7d')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState('')
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedMsg, setFeedMsg] = useState('')
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [triggerStatus, setTriggerStatus] = useState<Record<string, string>>({})
  const [feedChecked, setFeedChecked] = useState<Set<string>>(new Set())
  // Shorts 관리 상태
  const [shortsPersona, setShortsPersona] = useState('')
  const [shorts, setShorts] = useState<ShortRow[]>([])
  const [shortsLoading, setShortsLoading] = useState(false)
  const [shortsMsg, setShortsMsg] = useState('')
  const [shortsChecked, setShortsChecked] = useState<Set<string>>(new Set())
  // 유저 관리
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
    setBanAction(prev => ({ ...prev, [userId]: action === 'ban' ? '처리 중...' : '처리 중...' }))
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

  // 진입 시 인증 확인 — stats, personas, feedbacks 병렬 로드
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
    const data = await fetchStats(p)
    if (data) {
      setAccessLogs(data.access_logs)
      if (data.user_behavior) setUserBehavior(data.user_behavior)
    }
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
    const msg = data.status === 'queued' ? '✅ 큐에 추가됨' :
                data.status === 'already_queued' ? '⏳ 이미 대기 중' : '❌ 실패'
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
    if (!res.ok) {
      setFeedMsg('로드 실패')
      setFeedLoading(false)
      return
    }
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
    if (!res.ok) {
      setShortsMsg('로드 실패')
      setShortsLoading(false)
      return
    }
    const data = await res.json()
    setShorts(data.shorts ?? [])
    setShortsMsg(`${data.shorts?.length ?? 0}개`)
    setShortsLoading(false)
  }

  async function deleteShort(personaId: string, videoId: string) {
    if (!confirm('이 Shorts를 삭제할까요?')) return
    const res = await fetch(`/api/admin/shorts/${personaId}/${videoId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      setShorts(prev => prev.filter(s => s.video_id !== videoId))
      setShortsChecked(prev => { const n = new Set(prev); n.delete(videoId); return n })
      setShortsMsg(prev => { const n = parseInt(prev) - 1; return isNaN(n) ? prev : `${n}개` })
    } else {
      alert('삭제 실패')
    }
  }

  async function deleteCheckedShorts() {
    if (shortsChecked.size === 0) return
    if (!confirm(`선택한 ${shortsChecked.size}개의 Shorts를 삭제할까요?`)) return
    const ids = [...shortsChecked]
    await Promise.all(ids.map(id =>
      fetch(`/api/admin/shorts/${shortsPersona}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    ))
    setShorts(prev => prev.filter(s => !shortsChecked.has(s.video_id)))
    setShortsMsg(prev => { const n = parseInt(prev) - ids.length; return isNaN(n) ? prev : `${n}개` })
    setShortsChecked(new Set())
  }

  function toggleShortsCheck(videoId: string) {
    setShortsChecked(prev => {
      const n = new Set(prev)
      n.has(videoId) ? n.delete(videoId) : n.add(videoId)
      return n
    })
  }

  function toggleAllShorts() {
    if (shortsChecked.size === shorts.length) {
      setShortsChecked(new Set())
    } else {
      setShortsChecked(new Set(shorts.map(s => s.video_id)))
    }
  }

  async function deleteVideo(personaId: string, videoId: string) {
    if (!confirm('이 영상을 삭제할까요?')) return
    const res = await fetch(`/api/admin/feed/${personaId}/${videoId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) {
      setVideos(prev => prev.filter(v => v.video_id !== videoId))
      setFeedChecked(prev => { const n = new Set(prev); n.delete(videoId); return n })
      setFeedMsg(prev => { const n = parseInt(prev) - 1; return isNaN(n) ? prev : `${n}개` })
    } else {
      alert('삭제 실패')
    }
  }

  async function deleteCheckedVideos() {
    if (feedChecked.size === 0) return
    if (!confirm(`선택한 ${feedChecked.size}개의 영상을 삭제할까요?`)) return
    const ids = [...feedChecked]
    await Promise.all(ids.map(id =>
      fetch(`/api/admin/feed/${selectedPersona}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    ))
    setVideos(prev => prev.filter(v => !feedChecked.has(v.video_id)))
    setFeedMsg(prev => { const n = parseInt(prev) - ids.length; return isNaN(n) ? prev : `${n}개` })
    setFeedChecked(new Set())
  }

  function toggleFeedCheck(videoId: string) {
    setFeedChecked(prev => {
      const n = new Set(prev)
      n.has(videoId) ? n.delete(videoId) : n.add(videoId)
      return n
    })
  }

  function toggleAllFeed() {
    if (feedChecked.size === videos.length) {
      setFeedChecked(new Set())
    } else {
      setFeedChecked(new Set(videos.map(v => v.video_id)))
    }
  }

  if (view === 'login') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-semibold mb-6">Admin 로그인</h1>
          {loginError && (
            <div className="mb-4 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg p-3">
              {loginError}
            </div>
          )}
          <input
            type="password"
            placeholder="Admin Token"
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-zinc-100 text-zinc-900 font-medium py-2 rounded-lg hover:bg-white transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    )
  }

  // 페르소나 ID → 한글 이름 조회 헬퍼
  function personaName(pid: string): string {
    return personas.find(p => p.id === pid)?.name ?? pid
  }

  // 일별 접근 수 — 최근 7일 정렬
  const dailyEntries = Object.entries(accessLogs?.daily ?? {}).sort((a, b) => a[0].localeCompare(b[0]))
  const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1)

  return (
    <>
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
        <div>
          <h1 className="text-xl font-semibold">관리자 대시보드</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Anomess 관리</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← 피드 보기
          </a>
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-400 border border-zinc-700 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
          >
            로그아웃
          </button>
        </div>
      </header>

      <section className="px-6 py-6 max-w-7xl mx-auto space-y-10">

        {/* ── 접근 로그 통계 ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400">
              접근 통계 — {{ '7d': '최근 7일', '30d': '최근 30일', '90d': '최근 90일' }[statPeriod]}
            </h2>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs">
              {(['7d', '30d', '90d'] as StatPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => changePeriod(p)}
                  className={`px-3 py-1.5 transition-colors ${
                    statPeriod === p
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {{ '7d': '7일', '30d': '30일', '90d': '90일' }[p]}
                </button>
              ))}
            </div>
          </div>
          {accessLogs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {/* 외부 방문자 (나 제외) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">외부 방문자 <span className="text-zinc-600">(나 제외)</span></p>
                <p className="text-3xl font-bold text-emerald-400">{accessLogs.external_unique_ips.toLocaleString()}</p>
                <p className="text-xs text-zinc-600 mt-1">{{ '7d': '7일', '30d': '30일', '90d': '90일' }[statPeriod]}간 unique IP · 전체 {accessLogs.unique_ips}명</p>
              </div>

              {/* 총 요청 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">총 API 요청</p>
                <p className="text-3xl font-bold">{accessLogs.total_7d.toLocaleString()}</p>
                <p className="text-xs text-zinc-600 mt-1">{{ '7d': '7일', '30d': '30일', '90d': '90일' }[statPeriod]}간 누적</p>
              </div>

              {/* 페르소나별 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-2">페르소나별 요청</p>
                {Object.entries(accessLogs.by_persona).map(([pid, cnt]) => (
                  <div key={pid} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-400 truncate max-w-[70%]">{personaName(pid)}</span>
                    <span className="font-semibold">{cnt}</span>
                  </div>
                ))}
              </div>

              {/* 국가별 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-2">국가별 top10</p>
                {Object.entries(accessLogs.by_country).map(([country, cnt]) => (
                  <div key={country} className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-400">{country || '(unknown)'}</span>
                    <span className="font-semibold">{cnt}</span>
                  </div>
                ))}
              </div>

              {/* 일별 바 차트 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-3">일별 추이</p>
                <div className="flex items-end gap-1 h-20">
                  {dailyEntries.map(([day, cnt]) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-zinc-600 rounded-sm"
                        style={{ height: `${Math.round((cnt / maxDaily) * 72)}px` }}
                        title={`${day}: ${cnt}건`}
                      />
                      <span className="text-[9px] text-zinc-600">{day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">로그 없음 (아직 접근 기록 없음)</p>
          )}
        </div>

        {/* ── 유저 행동 분석 (최근 7일) ── */}
        {userBehavior && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 mb-3">📊 유저 행동 분석 — 최근 7일</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">고유 세션</p>
                <p className="text-3xl font-bold text-blue-400">{userBehavior.sessions_7d}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">영상 클릭</p>
                <p className="text-3xl font-bold">{userBehavior.video_clicks_7d}</p>
                <p className="text-xs text-zinc-600 mt-1">세션당 평균 {userBehavior.avg_clicks_per_session}회</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">스크롤 깊이</p>
                <div className="mt-1 space-y-1">
                  {(() => {
                    const d = userBehavior.scroll_depth
                    const total = d.page1_only + d.page2_4 + d.page5_plus
                    return total > 0 ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">1배치만</span>
                          <span>{Math.round(d.page1_only / total * 100)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">2-4배치</span>
                          <span>{Math.round(d.page2_4 / total * 100)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">5배치+</span>
                          <span className="text-emerald-400">{Math.round(d.page5_plus / total * 100)}%</span>
                        </div>
                      </>
                    ) : <p className="text-xs text-zinc-600">데이터 없음</p>
                  })()}
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-2">🔥 인기 영상 TOP 5</p>
                {userBehavior.top_videos.length === 0 ? (
                  <p className="text-xs text-zinc-600">데이터 없음</p>
                ) : (
                  <div className="space-y-1">
                    {userBehavior.top_videos.map((v, i) => (
                      <div key={v.video_id} className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-600 w-4">{i + 1}.</span>
                        <a
                          href={`https://www.youtube.com/watch?v=${v.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-zinc-200 truncate flex-1 font-mono"
                        >
                          {v.video_id}
                        </a>
                        <span className="text-zinc-300 font-semibold shrink-0">{v.clicks}클릭</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 영상 누적 현황 ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400">페르소나별 누적 현황 <span className="font-normal text-zinc-600 text-xs ml-1">👁 조회수는 최근 7일</span></h2>
            {likeStats && likeStats.total > 0 && (
              <span className="text-xs text-rose-400">♥ 총 좋아요 {likeStats.total.toLocaleString()}개</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(videoStats).length === 0 ? (
              <p className="text-zinc-500 text-sm">데이터 없음</p>
            ) : (
              Object.entries(videoStats).map(([pid, info]) => (
                <div key={pid} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">{personaName(pid)}</p>
                  <p className="text-2xl font-bold">
                    {info.total}
                    <span className="text-sm font-normal text-zinc-500">개</span>
                  </p>
                  {/* AI요약 / skip / 미완료 분포 */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded-full">
                      AI요약 {info.with_summary ?? 0}
                      {info.total > 0 && (
                        <span className="text-emerald-600 ml-0.5">
                          ({Math.round(((info.with_summary ?? 0) / info.total) * 100)}%)
                        </span>
                      )}
                    </span>
                    {(info.stt_skip ?? 0) > 0 && (
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                        skip {info.stt_skip}
                      </span>
                    )}
                    {(info.no_summary ?? 0) > 0 && (
                      <span className="text-xs bg-amber-900/30 text-amber-500 px-2 py-0.5 rounded-full">
                        미완료 {info.no_summary}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-zinc-600">최근: {info.latest_date ?? '-'}</p>
                    <div className="flex items-center gap-2">
                      {(accessLogs?.by_persona[pid] ?? 0) > 0 && (
                        <span className="text-xs text-sky-400">👁 {accessLogs!.by_persona[pid]}회</span>
                      )}
                      {(likeStats?.by_persona[pid] ?? 0) > 0 && (
                        <span className="text-xs text-rose-400">♥ {likeStats!.by_persona[pid]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── 수동 수집 트리거 ── */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">수동 수집 트리거</h2>
          <p className="text-xs text-zinc-500 mb-3">버튼 클릭 시 Ubuntu 봇이 다음 실행 시 즉시 수집을 시작합니다.</p>
          <div className="flex flex-wrap gap-3">
            {personas.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <button
                  onClick={() => triggerCollect(p.id)}
                  disabled={triggerStatus[p.id] === 'requesting'}
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  ▶ {p.name} 수집
                </button>
                {triggerStatus[p.id] && (
                  <span className="text-xs text-zinc-400">{triggerStatus[p.id]}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 피드백 목록 ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-400">피드백 목록</h2>
            <span className="text-xs text-zinc-500">{feedbacks.length}건</span>
          </div>
          {/* 별점 분포 요약 */}
          {feedbacks.length > 0 && (() => {
            const dist = [5,4,3,2,1].map(n => ({
              star: n,
              count: feedbacks.filter(f => f.rating === n).length,
            }))
            const rated = feedbacks.filter(f => f.rating).length
            const avg = rated > 0
              ? (feedbacks.reduce((s, f) => s + (f.rating ?? 0), 0) / rated).toFixed(1)
              : '-'
            return (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-amber-400 font-bold text-lg">★ {avg}</span>
                  {dist.map(d => (
                    <span key={d.star} className="text-xs text-zinc-400">
                      {'★'.repeat(d.star)}
                      <span className="text-zinc-500 ml-1">{d.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
          {feedbacks.length === 0 ? (
            <p className="text-zinc-500 text-sm">아직 피드백이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {feedbacks.map(fb => (
                <div key={fb.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-start gap-4">
                  <div className="shrink-0 text-amber-400 text-sm font-semibold w-12">
                    {fb.rating ? '★'.repeat(fb.rating) : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    {fb.content_suggestion && (
                      <div className="flex items-start gap-1.5 mb-1.5">
                        <span className="text-[10px] text-blue-400 bg-blue-950/40 border border-blue-800/40 rounded px-1.5 py-0.5 shrink-0 mt-0.5">콘텐츠 제안</span>
                        <p className="text-sm text-blue-200 break-words">{fb.content_suggestion}</p>
                      </div>
                    )}
                    <p className="text-sm text-zinc-200 break-words">{fb.comment || <span className="text-zinc-600 italic">코멘트 없음</span>}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <span>{personaName(fb.persona_id ?? '')}</span>
                      <span>·</span>
                      <span>{fb.lang?.toUpperCase()}</span>
                      <span>·</span>
                      <span>{fb.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 피드 관리 ── */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-sm font-semibold text-zinc-400">피드 관리</h2>
            <select
              value={selectedPersona}
              onChange={e => {
                setSelectedPersona(e.target.value)
                loadFeed(e.target.value)
              }}
              className="bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">페르소나 선택...</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {feedChecked.size > 0 && (
              <button
                onClick={deleteCheckedVideos}
                className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-3 py-1.5 rounded-lg"
              >
                선택 삭제 ({feedChecked.size})
              </button>
            )}
          </div>

          {feedMsg && <p className="text-sm text-zinc-500 mb-4">{feedMsg}</p>}

          {feedLoading && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-8">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              불러오는 중...
            </div>
          )}

          {!feedLoading && videos.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                  <th className="py-2 pr-3 w-8">
                    <input
                      type="checkbox"
                      checked={feedChecked.size === videos.length}
                      onChange={toggleAllFeed}
                      className="accent-zinc-400"
                    />
                  </th>
                  <th className="py-2 pr-4 font-medium">제목</th>
                  <th className="py-2 pr-4 font-medium w-32">채널</th>
                  <th className="py-2 pr-4 font-medium w-16 text-right">점수</th>
                  <th className="py-2 pr-4 font-medium w-24">날짜</th>
                  <th className="py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {videos.map(v => (
                  <tr key={v.video_id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={feedChecked.has(v.video_id)}
                        onChange={() => toggleFeedCheck(v.video_id)}
                        className="accent-zinc-400"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-300 line-clamp-1"
                      >
                        {v.titles_i18n?.ko || v.title}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-zinc-500 text-xs truncate max-w-[8rem]">
                      {v.channel}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs">{v.score}</td>
                    <td className="py-2 pr-4 text-zinc-500 text-xs">{v.collected_date}</td>
                    <td className="py-2">
                      <button
                        onClick={() => deleteVideo(selectedPersona, v.video_id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-0.5 rounded"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Shorts 관리 ── */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-sm font-semibold text-zinc-400">Shorts 관리</h2>
            <select
              value={shortsPersona}
              onChange={e => {
                setShortsPersona(e.target.value)
                loadShorts(e.target.value)
              }}
              className="bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="">페르소나 선택...</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {shortsChecked.size > 0 && (
              <button
                onClick={deleteCheckedShorts}
                className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-3 py-1.5 rounded-lg"
              >
                선택 삭제 ({shortsChecked.size})
              </button>
            )}
          </div>

          {shortsMsg && <p className="text-sm text-zinc-500 mb-4">{shortsMsg}</p>}

          {shortsLoading && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm py-8">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              불러오는 중...
            </div>
          )}

          {!shortsLoading && shorts.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                  <th className="py-2 pr-3 w-8">
                    <input
                      type="checkbox"
                      checked={shortsChecked.size === shorts.length}
                      onChange={toggleAllShorts}
                      className="accent-zinc-400"
                    />
                  </th>
                  <th className="py-2 pr-4 font-medium">제목</th>
                  <th className="py-2 pr-4 font-medium w-32">채널</th>
                  <th className="py-2 pr-4 font-medium w-16 text-right">점수</th>
                  <th className="py-2 pr-4 font-medium w-24">날짜</th>
                  <th className="py-2 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {shorts.map(s => (
                  <tr key={s.video_id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={shortsChecked.has(s.video_id)}
                        onChange={() => toggleShortsCheck(s.video_id)}
                        className="accent-zinc-400"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-300 line-clamp-1"
                      >
                        {s.titles_i18n?.ko || s.title}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-zinc-500 text-xs truncate max-w-[8rem]">
                      {s.channel}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs">{s.score}</td>
                    <td className="py-2 pr-4 text-zinc-500 text-xs">{s.collected_date}</td>
                    <td className="py-2">
                      <button
                        onClick={() => deleteShort(shortsPersona, s.video_id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-0.5 rounded"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </section>

      {/* ── 가입 유저 관리 ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">👤 가입 유저</h2>
          <button
            onClick={loadAdminUsers}
            disabled={adminUsersLoading}
            className="text-xs px-3 py-1 rounded border border-zinc-700 hover:border-zinc-500 disabled:opacity-50"
          >
            {adminUsersLoading ? '로딩 중...' : '목록 불러오기'}
          </button>
        </div>

        {adminUsers.length > 0 && (
          <>
            <p className="text-xs text-zinc-500">
              전체 {adminUsers.length}명 · 밴 {adminUsers.filter(u => u.is_banned).length}명
              · 페르소나 {adminUsers.reduce((s, u) => s + u.personas.length, 0)}개
            </p>
            <div className="space-y-2">
              {adminUsers.map(u => {
                const isExpanded = expandedUsers.has(u.id)
                const inactiveCount = u.personas.filter(p => p.is_inactive).length
                return (
                  <div key={u.id} className={`rounded-xl border ${u.is_banned ? 'border-red-900/60 bg-red-950/10' : 'border-zinc-800 bg-zinc-900/50'}`}>
                    {/* 유저 행 */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* 펼치기 토글 */}
                      <button
                        onClick={() => toggleUserExpand(u.id)}
                        className="text-zinc-500 hover:text-zinc-300 shrink-0 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d={isExpanded ? 'M2 5l5 5 5-5' : 'M5 2l5 5-5 5'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      {/* 유저 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-200 truncate">{u.email}</span>
                          {u.nickname && (
                            <span className="text-xs text-zinc-400 shrink-0">@{u.nickname}</span>
                          )}
                          {/* 상태 뱃지 */}
                          {u.is_banned ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700/50 shrink-0">Banned</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 shrink-0">Active</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                          <span>가입 {u.created_at.slice(0, 10)}</span>
                          {u.last_sign_in_at && <span>최근 {u.last_sign_in_at.slice(0, 10)}</span>}
                          <span>
                            페르소나 {u.personas.length}개
                            {inactiveCount > 0 && <span className="text-amber-500 ml-1">(비활성 {inactiveCount})</span>}
                          </span>
                        </div>
                      </div>

                      {/* Ban/Unban 버튼 */}
                      <button
                        onClick={() => {
                          if (confirm(u.is_banned ? `${u.email} 밴을 해제할까요?` : `${u.email}을 밴할까요?`)) {
                            handleBanUser(u.id, u.is_banned ? 'unban' : 'ban')
                          }
                        }}
                        disabled={!!banAction[u.id]}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors shrink-0 disabled:opacity-50 ${
                          u.is_banned
                            ? 'border-zinc-600 text-zinc-400 hover:border-emerald-600 hover:text-emerald-400'
                            : 'border-red-900 text-red-400 hover:border-red-600 hover:text-red-300'
                        }`}
                      >
                        {banAction[u.id] ? banAction[u.id] : u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>

                    {/* 페르소나 목록 (펼침) */}
                    {isExpanded && u.personas.length > 0 && (
                      <div className="border-t border-zinc-800/60 px-4 pb-3 pt-2 space-y-1.5">
                        {u.personas.map(p => (
                          <div key={p.persona_id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${p.is_inactive ? 'bg-amber-950/20' : 'bg-zinc-800/40'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <a
                                  href={`/p/${p.persona_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-zinc-200 hover:text-white truncate"
                                >
                                  {p.name}
                                </a>
                                {p.is_inactive && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50 shrink-0">비활성</span>
                                )}
                                {!p.is_public && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 shrink-0">비공개</span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                                <span>영상 {p.video_count}개 · {p.days_since_update}일 전 업데이트</span>
                                {(accessLogs?.by_persona[p.persona_id] ?? 0) > 0 && (
                                  <span className="text-sky-400">👁 {accessLogs!.by_persona[p.persona_id]}회</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {personaAction[p.persona_id] ? (
                                <span className="text-xs text-zinc-400">{personaAction[p.persona_id]}</span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handlePersonaAction(p.persona_id, u.id, 'notify')}
                                    className="text-xs px-2 py-0.5 rounded border border-zinc-700 hover:border-indigo-500 hover:text-indigo-400"
                                  >
                                    이메일
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`"${p.name}" 페르소나를 삭제할까요?`)) {
                                        handlePersonaAction(p.persona_id, u.id, 'delete')
                                      }
                                    }}
                                    className="text-xs px-2 py-0.5 rounded border border-red-900 text-red-400 hover:text-red-300"
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
                    {isExpanded && u.personas.length === 0 && (
                      <div className="border-t border-zinc-800/60 px-4 py-3 text-xs text-zinc-600">
                        페르소나 없음
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </>
  )
}
