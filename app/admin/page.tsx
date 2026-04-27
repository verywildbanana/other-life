'use client'

import { useEffect, useState } from 'react'
import { Persona } from '@/types'

type VideoStats = Record<string, { total: number; latest_date: string | null }>
type AccessLogs = {
  total_7d: number
  unique_ips: number
  external_unique_ips: number
  my_ip_hash: string
  by_persona: Record<string, number>
  by_country: Record<string, number>
  daily: Record<string, number>
}
type StatsResponse = { videos: VideoStats; access_logs: AccessLogs }

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
  const [personas, setPersonas] = useState<Persona[]>([])
  const [selectedPersona, setSelectedPersona] = useState('')
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedMsg, setFeedMsg] = useState('')
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])
  const [triggerStatus, setTriggerStatus] = useState<Record<string, string>>({})
  // Shorts 관리 상태
  const [shortsPersona, setShortsPersona] = useState('')
  const [shorts, setShorts] = useState<ShortRow[]>([])
  const [shortsLoading, setShortsLoading] = useState(false)
  const [shortsMsg, setShortsMsg] = useState('')
  const [shortsChecked, setShortsChecked] = useState<Set<string>>(new Set())

  // 진입 시 인증 확인 — stats, personas, feedbacks 병렬 로드
  useEffect(() => {
    Promise.all([fetchStats(), loadPersonas(), loadFeedbacks()]).then(([data]) => {
      if (data) {
        setVideoStats(data.videos)
        setAccessLogs(data.access_logs)
        setView('dashboard')
      }
    })
  }, [])

  async function fetchStats(): Promise<StatsResponse | null> {
    const res = await fetch('/api/admin/stats', { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
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
      setFeedMsg(prev => {
        const n = parseInt(prev) - 1
        return isNaN(n) ? prev : `${n}개`
      })
    } else {
      alert('삭제 실패')
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
          <p className="text-xs text-zinc-500 mt-0.5">Persona Feed 관리</p>
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

        {/* ── 접근 로그 통계 (최근 7일) ── */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">접근 통계 — 최근 7일</h2>
          {accessLogs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {/* 외부 방문자 (나 제외) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">외부 방문자 <span className="text-zinc-600">(나 제외)</span></p>
                <p className="text-3xl font-bold text-emerald-400">{accessLogs.external_unique_ips.toLocaleString()}</p>
                <p className="text-xs text-zinc-600 mt-1">7일간 unique IP · 전체 {accessLogs.unique_ips}명</p>
              </div>

              {/* 총 요청 */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 mb-1">총 API 요청</p>
                <p className="text-3xl font-bold">{accessLogs.total_7d.toLocaleString()}</p>
                <p className="text-xs text-zinc-600 mt-1">7일간 누적</p>
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

        {/* ── 영상 누적 현황 ── */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">페르소나별 누적 현황</h2>
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
                  <p className="text-xs text-zinc-600 mt-1">최근: {info.latest_date ?? '-'}</p>
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
                        {s.title}
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
    </>
  )
}
