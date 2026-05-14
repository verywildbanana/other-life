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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-4">Anomess</h1>
      <p className="text-lg text-zinc-300 max-w-xl">
        See the world more than your algorithm. Peek into other people&apos;s YouTube feeds
        and discover what you never knew you were missing.
      </p>
    </main>
  )
}
