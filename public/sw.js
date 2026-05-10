// Persona Feed — Service Worker (PWA 설치 활성화용)
// fetch 핸들러 없음 — cross-origin(YouTube 등) CORS 에러로 SW 크래시 방지
// install + activate만 등록해도 Android Chrome PWA 설치 기준 충족

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// fetch 핸들러 의도적으로 제거
// event.respondWith(fetch(request)) 패턴은 YouTube i.ytimg.com 등
// cross-origin 요청에서 CORS 에러 → SW 크래시 → PWA 설치 실패 유발
