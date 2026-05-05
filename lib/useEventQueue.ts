'use client'

/**
 * useEventQueue — 유저 행동 이벤트를 모아서 /api/events로 배치 전송
 *
 * - 이벤트를 큐에 누적 → 5초 디바운스 or 10개 이상이면 즉시 flush
 * - 페이지 언로드 시 navigator.sendBeacon으로 잔여 flush
 * - 실패 시 무시 (UX 영향 없음, GA4 병행 유지)
 * - events 테이블이 없는 경우에도 서버에서 조용히 실패 처리
 */

import { useCallback, useEffect, useRef } from 'react'

export interface UserEvent {
  type: 'video_click' | 'scroll_load' | 'shorts_click'
  persona_id: string
  video_id?: string
  position?: number    // 피드 내 위치 (1-based)
  scroll_page?: number // 몇 번째 배치 (1-based)
  lang?: string
}

const FLUSH_INTERVAL_MS = 5_000   // 5초 디바운스
const FLUSH_BATCH_SIZE  = 10      // 10개 누적 시 즉시 flush
const API_ENDPOINT      = '/api/events'

export function useEventQueue() {
  const queueRef  = useRef<UserEvent[]>([])
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushingRef = useRef(false)

  const flush = useCallback(async (events: UserEvent[]) => {
    if (events.length === 0) return
    if (flushingRef.current) return
    flushingRef.current = true
    try {
      await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      })
    } catch {
      // 실패 시 무시 — 이벤트 소실은 허용 (UX 우선)
    } finally {
      flushingRef.current = false
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const events = queueRef.current.splice(0)
      if (events.length > 0) flush(events)
    }, FLUSH_INTERVAL_MS)
  }, [flush])

  const enqueueEvent = useCallback((event: UserEvent) => {
    queueRef.current.push(event)
    if (queueRef.current.length >= FLUSH_BATCH_SIZE) {
      // 즉시 flush
      if (timerRef.current) clearTimeout(timerRef.current)
      const events = queueRef.current.splice(0)
      flush(events)
    } else {
      scheduleFlush()
    }
  }, [flush, scheduleFlush])

  // 페이지 언로드 시 잔여 이벤트 sendBeacon으로 flush
  useEffect(() => {
    const handleUnload = () => {
      const events = queueRef.current.splice(0)
      if (events.length === 0) return
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          API_ENDPOINT,
          new Blob([JSON.stringify({ events })], { type: 'application/json' }),
        )
      }
    }
    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('pagehide', handleUnload)
      window.removeEventListener('beforeunload', handleUnload)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { enqueueEvent }
}
