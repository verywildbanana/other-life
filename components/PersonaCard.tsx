'use client'

import Image from 'next/image'
import { Persona } from '@/types'

interface Props {
  persona: Persona
  lang: 'ko' | 'en' | 'ja'
}

export default function PersonaCard({ persona, lang }: Props) {
  const desc =
    persona.description_i18n?.[lang] ??
    persona.description_i18n?.['ko'] ??
    persona.description

  return (
    <a
      href={`/p/${persona.id}?lang=${lang}`}
      className="group relative block w-full h-full rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300"
    >
      {/* 배경 이미지 */}
      {persona.concept_image ? (
        <Image
          src={persona.concept_image}
          alt={desc}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}

      {/* 하단 그라디언트 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* 하단 텍스트 */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[11px] text-white/60 leading-snug line-clamp-2">
          {desc}
        </p>
      </div>
    </a>
  )
}
