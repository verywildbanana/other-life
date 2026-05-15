'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 루트(/) — Google 크롤러용 랜딩 콘텐츠 + 클라이언트 리다이렉트
// SSR로 브랜드 텍스트를 노출해 meta description이 검색결과에 반영되도록 함
// 사용자는 JS 로드 후 첫 번째 페르소나 피드로 자동 이동
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/p/wealthy_single_30s')
  }, [router])

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      {/* 사용자에게는 로고만 보임 — 리다이렉트 전 잠깐 표시 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/anomess-logo.png" alt="Anomess" className="h-24 w-auto rounded-2xl" />
      {/* 구글 크롤러용 desc — 배경과 동일 색으로 사람 눈에 안 보임, aria-hidden 제거로 크롤러 인덱싱 보장 */}
      <p className="text-zinc-950 select-none">
        See the world more than your algorithm. Peek into other people&apos;s YouTube feeds
        and discover what you never knew you were missing.
      </p>
    </main>
  )
}
