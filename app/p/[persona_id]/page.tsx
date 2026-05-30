import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPersonaAsync, listPersonas, listAllPersonas } from '@/lib/personas'
import FeedView from './FeedView'

interface Props {
  params: Promise<{ persona_id: string }>
  searchParams: Promise<{ lang?: string }>
}

const BASE_URL = 'https://play.anomess.com'

// 빌드 시 시스템 페르소나 경로만 사전 생성 (유저 페르소나는 동적 라우팅)
export async function generateStaticParams() {
  return listPersonas().map(p => ({ persona_id: p.id }))
}

// 언어별 메타데이터 텍스트
const META_TEXT = {
  ko: {
    titleSuffix: '— YouTube 알고리즘 피드 | Anomess',
    descTemplate: (name: string, desc: string) =>
      `${name}(${desc})의 YouTube 홈피드. 알고리즘이 이 페르소나에게 실제로 어떤 영상을 추천하는지 확인하세요.`,
    locale: 'ko_KR',
  },
  ja: {
    titleSuffix: '— YouTube アルゴリズムフィード | Anomess',
    descTemplate: (name: string, desc: string) =>
      `${name}(${desc})のYouTubeホームフィード。このペルソナにどんな動画が推薦されているか確認しましょう。`,
    locale: 'ja_JP',
  },
  en: {
    titleSuffix: '— YouTube Algorithm Feed | Anomess',
    descTemplate: (name: string, desc: string) =>
      `${name} (${desc}) YouTube home feed. See what videos the algorithm actually recommends to this persona.`,
    locale: 'en_US',
  },
} as const

type Lang = keyof typeof META_TEXT

// 페르소나별 메타태그 (SEO + OG) — 언어별 hreflang 포함
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { persona_id } = await params
  const { lang: langParam } = await searchParams
  const persona = await loadPersonaAsync(persona_id)
  if (!persona) return {}

  const lang: Lang = (langParam === 'ko' || langParam === 'ja' || langParam === 'en')
    ? langParam
    : 'ko'

  const meta = META_TEXT[lang]
  const nameI18n = (persona as unknown as { name_i18n?: Record<string, string> }).name_i18n
  const descI18n = (persona as unknown as { description_i18n?: Record<string, string> }).description_i18n
  const name = nameI18n?.[lang] ?? persona.name
  const desc = descI18n?.[lang] ?? persona.description

  const title = `${name} ${meta.titleSuffix}`
  const description = meta.descTemplate(name, desc)
  const canonicalUrl = `${BASE_URL}/p/${persona_id}`

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'ko': `${BASE_URL}/p/${persona_id}?lang=ko`,
        'ja': `${BASE_URL}/p/${persona_id}?lang=ja`,
        'en': `${BASE_URL}/p/${persona_id}?lang=en`,
        'x-default': `${BASE_URL}/p/${persona_id}?lang=en`,
      },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${BASE_URL}/p/${persona_id}?lang=${lang}`,
      locale: meta.locale,
      siteName: 'Anomess',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

// 피드 데이터는 클라이언트에서 fetch + shuffle → SSR 없음
// (토큰 인증 기반, noindex 설정 → 크롤러 대상 아님. 메타태그는 generateMetadata에서 처리)

export default async function PersonaPage({ params }: Props) {
  const { persona_id } = await params
  // 시스템 페르소나(파일) + 유저 페르소나(DB) 모두 처리
  const [persona, allPersonas] = await Promise.all([
    loadPersonaAsync(persona_id),
    listAllPersonas(),
  ])
  if (!persona) notFound()

  return <FeedView feed={null} persona={persona} allPersonas={allPersonas} />
}
