/**
 * viewedTracker.ts — device 단위 시청 이력 (localStorage, TTL 7일)
 *
 * - SSR/localStorage 비활성 환경에서는 빈 Set 폴백 → 기존 동작 유지
 * - gc()는 load 시 자동 호출 → 만료 항목 자동 정리
 */

const KEY = 'pf_viewed_v1'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7일

type ViewedMap = Record<string, number> // video_id → timestamp(ms)

function load(): ViewedMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as ViewedMap
  } catch {
    return {}
  }
}

function save(map: ViewedMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // 쓰기 실패 (프라이빗 모드 등) → 무시
  }
}

/** 7일 이상 지난 항목 정리 */
function gc(map: ViewedMap): ViewedMap {
  const cutoff = Date.now() - TTL_MS
  return Object.fromEntries(Object.entries(map).filter(([, t]) => t >= cutoff))
}

/** 영상 시청 기록 — 클릭 시 호출 */
export function markViewed(videoId: string): void {
  const map = gc(load())
  map[videoId] = Date.now()
  save(map)
}

/** 시청한 video_id 집합 반환 — Epoch 셔플 시 패널티용 */
export function getViewedSet(): Set<string> {
  return new Set(Object.keys(gc(load())))
}
