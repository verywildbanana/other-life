import type { NextConfig } from "next";

const securityHeaders = [
  // 클릭재킹 방지
  { key: 'X-Frame-Options', value: 'DENY' },
  // MIME 타입 스니핑 방지
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // XSS 필터 (레거시 브라우저)
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  // 리퍼러 정보 제한
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HTTPS 강제 (1년, 서브도메인 포함)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // 불필요한 브라우저 기능 차단
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  images: {
    // Vercel 이미지 최적화 무료 한도 초과(402) 우회 — i.ytimg.com 직접 로드
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // 모든 페이지에 보안 헤더 적용
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // 피드 API: play.anomess.com + other-life.vercel.app 허용 (공개 읽기 전용)
        source: '/api/feed/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
      {
        // ingest API: feed_token 인증이 실질적 보안 — CORS 완화
        source: '/api/ingest/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST' },
        ],
      },
    ]
  },
}

export default nextConfig;
