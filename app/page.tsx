'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 루트(/) — 브라우저 언어 감지 후 언어별 피드로 리디렉션
// ko → ?lang=ko, ja → ?lang=ja, 그 외 → ?lang=en
export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const browserLang = navigator.language ?? ''
    let lang = 'en'
    if (browserLang.startsWith('ko')) lang = 'ko'
    else if (browserLang.startsWith('ja')) lang = 'ja'
    router.replace(`/p/wealthy_single_30s?lang=${lang}`)
  }, [router])

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/anomess-logo.png" alt="Anomess" className="h-24 w-auto rounded-2xl" />
    </main>
  )
}
