'use client'

// 모든 서비스 페이지 상단 고정 헤더 — Anomess 아이콘 클릭 시 피드 진입
export default function AnoHeader({ defaultPersonaId = 'wealthy_single_30s' }: { defaultPersonaId?: string }) {
  return (
    <header className="w-full px-4 py-3 flex items-center border-b border-zinc-800 bg-zinc-950">
      <a
        href={`/p/${defaultPersonaId}`}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Anomess 피드로 이동"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/anomess-logo.png"
          alt="Anomess"
          className="h-8 w-8 rounded-xl"
        />
        <span className="text-white font-semibold text-sm tracking-tight">Anomess</span>
      </a>
    </header>
  )
}
