// Persona Feed — Service Worker (PWA 설치 활성화용)
// 오프라인 캐시 없이 최소 등록만 — Android 홈 화면 추가 배너 활성화 목적

const CACHE_NAME = 'persona-feed-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// fetch는 그냥 네트워크 통과 (캐시 없음)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
