import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFeedByPersona } from '@/lib/feed'
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
        'ko': url,
        'en': url,
        'ja': url,
        'x-default': url,
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

// SSR: 서버에서 피드 데이터 fetch → 초기 HTML에 영상 목록 포함 → 크롤러가 읽을 수 있음
export const revalidate = 3600 // 1시간마다 ISR 재생성

export default async function PersonaPage({ params }: Props) {
  const { persona_id } = await params
  const persona = loadPersona(persona_id)
  if (!persona) notFound()

  const [feed, allPersonas] = await Promise.all([
    getFeedByPersona(persona_id),
    Promise.resolve(listPersonas()),
  ])

  return <FeedView feed={feed} persona={persona} allPersonas={allPersonas} />
}
