'use client'

import { Persona } from '@/types'
import PersonaCard from './PersonaCard'

interface Props {
  personas: Persona[]
  lang: 'ko' | 'en' | 'ja'
}

// 패턴 A: 좌대형(세로2) + 우상단 와이드 + 우하단 2분할  (4개)
function PatternA({ personas, lang }: { personas: Persona[]; lang: Props['lang'] }) {
  return (
    <div className="grid gap-2" style={{
      gridTemplateColumns: '1.4fr 1fr 1fr',
      gridTemplateRows: '200px 140px',
    }}>
      <div style={{ gridColumn: '1', gridRow: '1 / 3' }}>
        <PersonaCard persona={personas[0]} lang={lang} />
      </div>
      {personas[1] && (
        <div style={{ gridColumn: '2 / 4', gridRow: '1' }}>
          <PersonaCard persona={personas[1]} lang={lang} />
        </div>
      )}
      {personas[2] && (
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <PersonaCard persona={personas[2]} lang={lang} />
        </div>
      )}
      {personas[3] && (
        <div style={{ gridColumn: '3', gridRow: '2' }}>
          <PersonaCard persona={personas[3]} lang={lang} />
        </div>
      )}
    </div>
  )
}

// 패턴 B: 상단 와이드 + 하단 3균등  (4개)
function PatternB({ personas, lang }: { personas: Persona[]; lang: Props['lang'] }) {
  return (
    <div className="grid gap-2" style={{
      gridTemplateColumns: '1fr 1fr 1fr',
      gridTemplateRows: '180px 150px',
    }}>
      <div style={{ gridColumn: '1 / 3', gridRow: '1' }}>
        <PersonaCard persona={personas[0]} lang={lang} />
      </div>
      {personas[1] && (
        <div style={{ gridColumn: '3', gridRow: '1' }}>
          <PersonaCard persona={personas[1]} lang={lang} />
        </div>
      )}
      {personas[2] && (
        <div style={{ gridColumn: '1', gridRow: '2' }}>
          <PersonaCard persona={personas[2]} lang={lang} />
        </div>
      )}
      {personas[3] && (
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <PersonaCard persona={personas[3]} lang={lang} />
        </div>
      )}
      {personas[4] && (
        <div style={{ gridColumn: '3', gridRow: '2' }}>
          <PersonaCard persona={personas[4]} lang={lang} />
        </div>
      )}
    </div>
  )
}

// 패턴 C: 우대형(세로2) + 좌상단 와이드 + 좌하단 2분할  (4개)
function PatternC({ personas, lang }: { personas: Persona[]; lang: Props['lang'] }) {
  return (
    <div className="grid gap-2" style={{
      gridTemplateColumns: '1fr 1fr 1.4fr',
      gridTemplateRows: '200px 140px',
    }}>
      <div style={{ gridColumn: '1 / 3', gridRow: '1' }}>
        <PersonaCard persona={personas[0]} lang={lang} />
      </div>
      {personas[1] && (
        <div style={{ gridColumn: '3', gridRow: '1 / 3' }}>
          <PersonaCard persona={personas[1]} lang={lang} />
        </div>
      )}
      {personas[2] && (
        <div style={{ gridColumn: '1', gridRow: '2' }}>
          <PersonaCard persona={personas[2]} lang={lang} />
        </div>
      )}
      {personas[3] && (
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <PersonaCard persona={personas[3]} lang={lang} />
        </div>
      )}
    </div>
  )
}

const PATTERNS = [
  { Component: PatternA, size: 4 },
  { Component: PatternB, size: 5 },
  { Component: PatternC, size: 4 },
]

export default function PersonaGrid({ personas, lang }: Props) {
  const chunks: { Component: typeof PatternA; items: Persona[] }[] = []
  let idx = 0
  let patternIdx = 0

  while (idx < personas.length) {
    const { Component, size } = PATTERNS[patternIdx % PATTERNS.length]
    chunks.push({ Component, items: personas.slice(idx, idx + size) })
    idx += size
    patternIdx++
  }

  return (
    <div className="flex flex-col gap-2">
      {chunks.map((chunk, i) => {
        const PatternComponent = chunk.Component
        return <PatternComponent key={i} personas={chunk.items} lang={lang} />
      })}
    </div>
  )
}
