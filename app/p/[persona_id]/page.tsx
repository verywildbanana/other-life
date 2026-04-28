import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPersona, listPersonas } from '@/lib/personas'
import FeedView from './FeedView'

interface Props {
  params: Promise<{ persona_id: string }>
}

const BASE_URL = 'https://other-life.vercel.app'

// 빌드 시 알려진 페르소나 경로 사전 생성
export async function generateStaticParams() {
  return listPersonas().map(p => ({ persona_id: p.id }))
}

// 페르소나별 메타태그 (SEO + OG)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { persona_id } = await params
  const persona = loadPersona(persona_id)
  if (!persona) return {}

  const title = `${persona.name} — YouTube 알고리즘 피드 | Persona Feed`
  const description = `${persona.name}(${persona.description})의 YouTube 홈피드. 알고리즘이 이 페르소나에게 실제로 어떤 영상을 추천하는지 확인하세요.`
  const url = `${BASE_URL}/p/${persona_id}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'ko-KR': `${BASE_URL}/p/${persona_id}`,
        'en-US': `${BASE_URL}/p/${persona_id}`,
        'ja-JP': `${BASE_URL}/p/${persona_id}`,
        'x-default': `${BASE_URL}/p/${persona_id}`,
      },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      locale: 'ko_KR',
      siteName: 'Persona Feed',
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
  const persona = loadPersona(persona_id)
  if (!persona) notFound()

  const allPersonas = listPersonas()

  return <FeedView feed={null} persona={persona} allPersonas={allPersonas} />
}
